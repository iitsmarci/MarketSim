import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  PERCENTILE_KEYS,
  type PercentileKey,
  type SimulationResult,
  type SimulationSeed,
} from '@marketsim/domain';

import type { ValueMode } from '../../components/fan-chart-model';
import {
  buildSimulationJob,
  DEFAULT_SIMULATION_SEED,
  initialAssumptions,
  type AssumptionValues,
  type BuildSimulationJobResult,
} from '../simulation/simulation-job';

export type ScenarioId = 'a' | 'b';

export type ScenarioAssumptionValues = Omit<AssumptionValues, 'simulationCount'>;

export interface ScenarioComparisonSettings {
  readonly modelVersion: typeof MONTHLY_LOGNORMAL_MODEL_VERSION;
  readonly seed: SimulationSeed;
  readonly simulationCount: string;
}

export const scenarioAInitialAssumptions: ScenarioAssumptionValues = Object.freeze({
  annualInflation: initialAssumptions.annualInflation,
  annualReturn: initialAssumptions.annualReturn,
  horizonYears: initialAssumptions.horizonYears,
  initialCapital: initialAssumptions.initialCapital,
  monthlyContribution: initialAssumptions.monthlyContribution,
  volatility: initialAssumptions.volatility,
});

export const scenarioBInitialAssumptions: ScenarioAssumptionValues = Object.freeze({
  annualInflation: '2.5',
  annualReturn: '6.5',
  horizonYears: '30',
  initialCapital: '10000',
  monthlyContribution: '650',
  volatility: '14',
});

export const initialScenarioComparisonSettings: ScenarioComparisonSettings =
  Object.freeze({
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: DEFAULT_SIMULATION_SEED,
    simulationCount: initialAssumptions.simulationCount,
  });

export interface ScenarioPairBuildResult {
  readonly a: BuildSimulationJobResult;
  readonly b: BuildSimulationJobResult;
}

export function buildScenarioPair(
  scenarioA: ScenarioAssumptionValues,
  scenarioB: ScenarioAssumptionValues,
  settings: ScenarioComparisonSettings,
): ScenarioPairBuildResult {
  const buildSettings = {
    modelVersion: settings.modelVersion,
    seed: settings.seed,
  } as const;

  return Object.freeze({
    a: buildSimulationJob(
      { ...scenarioA, simulationCount: settings.simulationCount },
      buildSettings,
    ),
    b: buildSimulationJob(
      { ...scenarioB, simulationCount: settings.simulationCount },
      buildSettings,
    ),
  });
}

export const COMPARISON_METRIC_KEYS = ['totalContributed', ...PERCENTILE_KEYS] as const;

export type ComparisonMetricKey = 'totalContributed' | PercentileKey;

export interface ScenarioComparisonValues {
  readonly scenarioA: number | undefined;
  readonly scenarioB: number | undefined;
  /** Difference between the two aggregate values at this exact month. */
  readonly delta: number | undefined;
}

export type ScenarioCheckpointValues = Readonly<
  Record<ComparisonMetricKey, ScenarioComparisonValues>
>;

export interface ScenarioComparisonCheckpoint {
  readonly month: number;
  readonly values: ScenarioCheckpointValues;
}

export interface ScenarioComparisonModel {
  readonly commonFinalMonth: number;
  readonly finalMonth: number;
  readonly mode: ValueMode;
  readonly scenarioAFinalMonth: number;
  readonly scenarioBFinalMonth: number;
  readonly checkpoints: readonly Readonly<ScenarioComparisonCheckpoint>[];
}

function values(
  scenarioA: number | undefined,
  scenarioB: number | undefined,
): ScenarioComparisonValues {
  return Object.freeze({
    scenarioA,
    scenarioB,
    delta:
      scenarioA === undefined || scenarioB === undefined
        ? undefined
        : scenarioB - scenarioA,
  });
}

function assertComparable(
  scenarioA: Readonly<SimulationResult>,
  scenarioB: Readonly<SimulationResult>,
): void {
  if (
    scenarioA.seed !== scenarioB.seed ||
    scenarioA.modelVersion !== scenarioB.modelVersion ||
    scenarioA.config.simulationCount !== scenarioB.config.simulationCount
  ) {
    throw new RangeError(
      'Scenario comparison requires the same seed, model, and simulation count.',
    );
  }
}

function trajectoryForResult(result: Readonly<SimulationResult>, mode: ValueMode) {
  const trajectory = mode === 'real' ? result.realValues.trajectory : result.trajectory;

  if (trajectory.length !== result.config.durationMonths + 1) {
    throw new RangeError(
      'Scenario trajectories must contain every exact monthly checkpoint.',
    );
  }

  trajectory.forEach((point, index) => {
    if (point.month !== index) {
      throw new RangeError(
        'Scenario trajectories must contain every exact monthly checkpoint.',
      );
    }
  });

  return trajectory;
}

export function buildScenarioComparison(
  scenarioA: Readonly<SimulationResult>,
  scenarioB: Readonly<SimulationResult>,
  mode: ValueMode,
): Readonly<ScenarioComparisonModel> {
  assertComparable(scenarioA, scenarioB);
  const trajectoryA = trajectoryForResult(scenarioA, mode);
  const trajectoryB = trajectoryForResult(scenarioB, mode);
  const scenarioAFinalMonth = scenarioA.config.durationMonths;
  const scenarioBFinalMonth = scenarioB.config.durationMonths;
  const commonFinalMonth = Math.min(scenarioAFinalMonth, scenarioBFinalMonth);
  const finalMonth = Math.max(scenarioAFinalMonth, scenarioBFinalMonth);

  const checkpoints = Array.from({ length: finalMonth + 1 }, (_, month) => {
    const pointA = trajectoryA[month];
    const pointB = trajectoryB[month];

    return Object.freeze({
      month,
      values: Object.freeze({
        totalContributed: values(pointA?.moneyContributed, pointB?.moneyContributed),
        ...Object.fromEntries(
          PERCENTILE_KEYS.map((key) => [
            key,
            values(pointA?.percentiles[key], pointB?.percentiles[key]),
          ]),
        ),
      }),
    }) as Readonly<ScenarioComparisonCheckpoint>;
  });

  return Object.freeze({
    commonFinalMonth,
    finalMonth,
    mode,
    scenarioAFinalMonth,
    scenarioBFinalMonth,
    checkpoints: Object.freeze(checkpoints),
  });
}
