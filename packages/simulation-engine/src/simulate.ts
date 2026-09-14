import {
  LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
  LEGACY_SIMULATION_RESULT_SCHEMA_VERSION,
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  PERCENTILE_KEYS,
  RANDOMNESS_ALGORITHM_VERSION,
  SIMULATION_RESULT_SCHEMA_VERSION,
  validateSupportedSimulationJob,
  type AggregatedTrajectoryPoint,
  type ContributionSummary,
  type DistributionStatistics,
  type LegacySimulationConfig,
  type LegacySimulationJob,
  type LegacySimulationResult,
  type PercentileValues,
  type RealAggregatedTrajectoryPoint,
  type RealValueResult,
  type SimulationConfig,
  type SimulationJob,
  type SimulationResult,
  type SupportedSimulationJob,
  type SupportedSimulationResult,
} from '@marketsim/domain';

import {
  InvalidRandomSampleError,
  SimulationDerivedValueError,
  SimulationNumericalError,
  SimulationValidationError,
} from './errors';
import {
  annualToMonthlyInflationParameters,
  calculatePriceIndex,
} from './inflation-model';
import {
  annualToMonthlyLognormalParameters,
  calculateMonthlyGrowthFactor,
} from './lognormal-model';
import type { NormalRandomSource } from './random';
import { SeededNormalRandomSource } from './seeded-normal-source';
import {
  calculateDistributionStatistics,
  scaleDistributionStatistics,
  shiftDistributionStatistics,
} from './statistics';

interface NominalSimulationOutput {
  readonly contributions: Readonly<ContributionSummary>;
  readonly finalValueStatistics: Readonly<DistributionStatistics>;
  readonly investmentGrowthStatistics: Readonly<DistributionStatistics>;
  readonly trajectory: readonly Readonly<AggregatedTrajectoryPoint>[];
}

function trajectoryPoint(
  month: number,
  moneyContributed: number,
  statistics: DistributionStatistics,
): Readonly<AggregatedTrajectoryPoint> {
  return Object.freeze({
    month,
    moneyContributed,
    mean: statistics.mean,
    percentiles: statistics.percentiles,
  });
}

/**
 * Runs the unchanged nominal monthly model using month-major random consumption:
 * month 1/path 0..N-1, then month 2/path 0..N-1, and so on.
 */
function runNominalSimulation(
  config: Readonly<LegacySimulationConfig>,
  randomSource: NormalRandomSource,
): Readonly<NominalSimulationOutput> {
  const parameters = annualToMonthlyLognormalParameters(
    config.annualExpectedReturn,
    config.annualVolatility,
  );
  const balances = new Float64Array(config.simulationCount);
  balances.fill(config.initialCapital);

  let finalStatistics = calculateDistributionStatistics(balances);
  const trajectory: AggregatedTrajectoryPoint[] = [
    trajectoryPoint(0, config.initialCapital, finalStatistics),
  ];

  for (let month = 1; month <= config.durationMonths; month += 1) {
    for (let pathIndex = 0; pathIndex < balances.length; pathIndex += 1) {
      const standardNormal =
        parameters.monthlyVolatility === 0 ? 0 : randomSource.nextStandardNormal();

      if (!Number.isFinite(standardNormal)) {
        throw new InvalidRandomSampleError(month, pathIndex, standardNormal);
      }

      const growthFactor = calculateMonthlyGrowthFactor(parameters, standardNormal);
      const currentBalance = balances[pathIndex];
      if (currentBalance === undefined) {
        throw new SimulationNumericalError(month, pathIndex);
      }

      const nextBalance = currentBalance * growthFactor + config.monthlyContribution;
      if (!Number.isFinite(nextBalance)) {
        throw new SimulationNumericalError(month, pathIndex);
      }

      balances[pathIndex] = nextBalance;
    }

    finalStatistics = calculateDistributionStatistics(balances);
    trajectory.push(
      trajectoryPoint(
        month,
        config.initialCapital + config.monthlyContribution * month,
        finalStatistics,
      ),
    );
  }

  const periodicContributions = config.monthlyContribution * config.durationMonths;
  const contributions: ContributionSummary = Object.freeze({
    initialCapital: config.initialCapital,
    periodicContributions,
    totalContributions: config.initialCapital + periodicContributions,
  });

  return Object.freeze({
    contributions,
    finalValueStatistics: finalStatistics,
    investmentGrowthStatistics: shiftDistributionStatistics(
      finalStatistics,
      -contributions.totalContributions,
    ),
    trajectory: Object.freeze(trajectory),
  });
}

function scalePercentiles(
  percentiles: PercentileValues,
  scale: number,
  month: number,
): PercentileValues {
  const scaled = Object.fromEntries(
    PERCENTILE_KEYS.map((key) => [key, percentiles[key] * scale]),
  ) as Record<(typeof PERCENTILE_KEYS)[number], number>;

  if (PERCENTILE_KEYS.some((key) => !Number.isFinite(scaled[key]))) {
    throw new SimulationDerivedValueError(month, 'trajectory percentile');
  }

  return Object.freeze(scaled);
}

function deriveRealValues(
  config: Readonly<SimulationConfig>,
  nominal: Readonly<NominalSimulationOutput>,
): Readonly<RealValueResult> {
  const inflation = annualToMonthlyInflationParameters(config.annualInflation);
  const trajectory: RealAggregatedTrajectoryPoint[] = [];
  let periodicRealContributions = 0;

  for (const nominalPoint of nominal.trajectory) {
    let priceIndex: number;
    try {
      priceIndex = calculatePriceIndex(inflation, nominalPoint.month);
    } catch {
      throw new SimulationDerivedValueError(nominalPoint.month, 'price index');
    }

    const scale = 1 / priceIndex;
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new SimulationDerivedValueError(nominalPoint.month, 'price-index scale');
    }

    if (nominalPoint.month > 0) {
      periodicRealContributions += config.monthlyContribution * scale;
    }

    const realMean = nominalPoint.mean * scale;
    const totalRealContributions = config.initialCapital + periodicRealContributions;
    if (
      !Number.isFinite(periodicRealContributions) ||
      !Number.isFinite(totalRealContributions) ||
      !Number.isFinite(realMean)
    ) {
      throw new SimulationDerivedValueError(nominalPoint.month, 'trajectory value');
    }

    trajectory.push(
      Object.freeze({
        month: nominalPoint.month,
        priceIndex,
        moneyContributed: totalRealContributions,
        mean: realMean,
        percentiles: scalePercentiles(
          nominalPoint.percentiles,
          scale,
          nominalPoint.month,
        ),
      }),
    );
  }

  const finalPoint = trajectory.at(-1);
  if (!finalPoint) {
    throw new SimulationDerivedValueError(0, 'trajectory');
  }

  let finalValueStatistics: Readonly<DistributionStatistics>;
  try {
    finalValueStatistics = scaleDistributionStatistics(
      nominal.finalValueStatistics,
      1 / finalPoint.priceIndex,
    );
  } catch {
    throw new SimulationDerivedValueError(config.durationMonths, 'final statistics');
  }

  const contributions = Object.freeze({
    initialCapital: config.initialCapital,
    periodicContributions: periodicRealContributions,
    totalContributions: config.initialCapital + periodicRealContributions,
  });

  return Object.freeze({
    contributions,
    finalValueStatistics,
    investmentGrowthStatistics: shiftDistributionStatistics(
      finalValueStatistics,
      -contributions.totalContributions,
    ),
    trajectory: Object.freeze(trajectory),
  });
}

function runValidatedSimulation(
  job: Readonly<SupportedSimulationJob>,
  randomSource: NormalRandomSource,
): Readonly<SupportedSimulationResult> {
  const nominal = runNominalSimulation(job.config, randomSource);

  if (job.modelVersion === LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION) {
    const result: LegacySimulationResult = Object.freeze({
      schemaVersion: LEGACY_SIMULATION_RESULT_SCHEMA_VERSION,
      modelVersion: LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
      randomnessAlgorithm: RANDOMNESS_ALGORITHM_VERSION,
      seed: job.seed,
      config: job.config,
      ...nominal,
    });
    return result;
  }

  const result: SimulationResult = Object.freeze({
    schemaVersion: SIMULATION_RESULT_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    randomnessAlgorithm: RANDOMNESS_ALGORITHM_VERSION,
    seed: job.seed,
    config: job.config,
    ...nominal,
    realValues: deriveRealValues(job.config, nominal),
  });
  return result;
}

export function simulateWithRandomSource(
  job: LegacySimulationJob,
  randomSource: NormalRandomSource,
): Readonly<LegacySimulationResult>;
export function simulateWithRandomSource(
  job: SimulationJob,
  randomSource: NormalRandomSource,
): Readonly<SimulationResult>;
export function simulateWithRandomSource(
  job: SupportedSimulationJob,
  randomSource: NormalRandomSource,
): Readonly<SupportedSimulationResult>;
/** Internal test seam for model behavior with an explicitly controlled source. */
export function simulateWithRandomSource(
  job: SupportedSimulationJob,
  randomSource: NormalRandomSource,
): Readonly<SupportedSimulationResult> {
  const validation = validateSupportedSimulationJob(job);
  if (!validation.valid) {
    throw new SimulationValidationError(validation.issues);
  }

  return runValidatedSimulation(validation.value, randomSource);
}

export function simulate(job: LegacySimulationJob): Readonly<LegacySimulationResult>;
export function simulate(job: SimulationJob): Readonly<SimulationResult>;
export function simulate(
  job: SupportedSimulationJob,
): Readonly<SupportedSimulationResult>;
/** Runs a complete deterministic simulation from a supported serializable job. */
export function simulate(
  job: SupportedSimulationJob,
): Readonly<SupportedSimulationResult> {
  const validation = validateSupportedSimulationJob(job);
  if (!validation.valid) {
    throw new SimulationValidationError(validation.issues);
  }

  return runValidatedSimulation(
    validation.value,
    new SeededNormalRandomSource(validation.value.seed),
  );
}
