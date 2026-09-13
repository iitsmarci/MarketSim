import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  RANDOMNESS_ALGORITHM_VERSION,
  SIMULATION_RESULT_SCHEMA_VERSION,
  validateSimulationJob,
  type AggregatedTrajectoryPoint,
  type ContributionSummary,
  type DistributionStatistics,
  type SimulationJob,
  type SimulationResult,
} from '@marketsim/domain';

import {
  InvalidRandomSampleError,
  SimulationNumericalError,
  SimulationValidationError,
} from './errors';
import {
  annualToMonthlyLognormalParameters,
  calculateMonthlyGrowthFactor,
} from './lognormal-model';
import type { NormalRandomSource } from './random';
import { SeededNormalRandomSource } from './seeded-normal-source';
import {
  calculateDistributionStatistics,
  shiftDistributionStatistics,
} from './statistics';

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
 * Runs the monthly lognormal model using month-major random consumption:
 * month 1/path 0..N-1, then month 2/path 0..N-1, and so on.
 */
function runValidatedSimulation(
  normalizedJob: Readonly<SimulationJob>,
  randomSource: NormalRandomSource,
): Readonly<SimulationResult> {
  const normalizedConfig = normalizedJob.config;
  const parameters = annualToMonthlyLognormalParameters(
    normalizedConfig.annualExpectedReturn,
    normalizedConfig.annualVolatility,
  );
  const balances = new Float64Array(normalizedConfig.simulationCount);
  balances.fill(normalizedConfig.initialCapital);

  let finalStatistics = calculateDistributionStatistics(balances);
  const trajectory: AggregatedTrajectoryPoint[] = [
    trajectoryPoint(0, normalizedConfig.initialCapital, finalStatistics),
  ];

  for (let month = 1; month <= normalizedConfig.durationMonths; month += 1) {
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

      const nextBalance =
        currentBalance * growthFactor + normalizedConfig.monthlyContribution;
      if (!Number.isFinite(nextBalance)) {
        throw new SimulationNumericalError(month, pathIndex);
      }

      balances[pathIndex] = nextBalance;
    }

    finalStatistics = calculateDistributionStatistics(balances);
    trajectory.push(
      trajectoryPoint(
        month,
        normalizedConfig.initialCapital + normalizedConfig.monthlyContribution * month,
        finalStatistics,
      ),
    );
  }

  const periodicContributions =
    normalizedConfig.monthlyContribution * normalizedConfig.durationMonths;
  const contributions: ContributionSummary = Object.freeze({
    initialCapital: normalizedConfig.initialCapital,
    periodicContributions,
    totalContributions: normalizedConfig.initialCapital + periodicContributions,
  });

  return Object.freeze({
    schemaVersion: SIMULATION_RESULT_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    randomnessAlgorithm: RANDOMNESS_ALGORITHM_VERSION,
    seed: normalizedJob.seed,
    config: normalizedConfig,
    contributions,
    finalValueStatistics: finalStatistics,
    investmentGrowthStatistics: shiftDistributionStatistics(
      finalStatistics,
      -contributions.totalContributions,
    ),
    trajectory: Object.freeze(trajectory),
  });
}

/** Internal test seam for model behavior with an explicitly controlled source. */
export function simulateWithRandomSource(
  job: SimulationJob,
  randomSource: NormalRandomSource,
): Readonly<SimulationResult> {
  const validation = validateSimulationJob(job);
  if (!validation.valid) {
    throw new SimulationValidationError(validation.issues);
  }

  return runValidatedSimulation(validation.value, randomSource);
}

/** Runs a complete deterministic simulation from a serializable seeded job. */
export function simulate(job: SimulationJob): Readonly<SimulationResult> {
  const validation = validateSimulationJob(job);
  if (!validation.valid) {
    throw new SimulationValidationError(validation.issues);
  }

  return runValidatedSimulation(
    validation.value,
    new SeededNormalRandomSource(validation.value.seed),
  );
}
