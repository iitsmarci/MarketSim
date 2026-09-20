import { PERCENTILE_KEYS, type PercentileKey } from '@marketsim/domain';

import {
  FAN_CHART_PLOT,
  buildTimeTicks,
  niceMaximum,
  type ChartPoint,
} from '../../components/fan-chart-model';
import type {
  ScenarioComparisonCheckpoint,
  ScenarioComparisonModel,
} from './scenario-comparison';

export interface ScenarioChartSeries {
  readonly percentiles: Readonly<Record<PercentileKey, readonly ChartPoint[]>>;
  readonly totalContributed: readonly ChartPoint[];
}

export interface ScenarioComparisonChartModel {
  readonly checkpoints: readonly Readonly<ScenarioComparisonCheckpoint>[];
  readonly maximumValue: number;
  readonly scenarioA: Readonly<ScenarioChartSeries>;
  readonly scenarioB: Readonly<ScenarioChartSeries>;
  readonly xForMonth: (month: number) => number;
  readonly xTicks: readonly number[];
  readonly yForValue: (value: number) => number;
  readonly yTicks: readonly number[];
}

function exactCheckpoint(
  checkpoints: readonly Readonly<ScenarioComparisonCheckpoint>[],
  month: number,
): Readonly<ScenarioComparisonCheckpoint> {
  const checkpoint = checkpoints.find((candidate) => candidate.month === month);
  if (!checkpoint) {
    throw new RangeError(`Comparison checkpoint ${String(month)} is not available.`);
  }
  return checkpoint;
}

function series(
  comparison: Readonly<ScenarioComparisonModel>,
  scenario: 'scenarioA' | 'scenarioB',
  xForMonth: (month: number) => number,
  yForValue: (value: number) => number,
): ScenarioChartSeries {
  const points = (key: 'totalContributed' | PercentileKey) =>
    Object.freeze(
      comparison.checkpoints.flatMap((checkpoint) => {
        const value = checkpoint.values[key][scenario];
        return value === undefined
          ? []
          : [{ x: xForMonth(checkpoint.month), y: yForValue(value) }];
      }),
    );

  return Object.freeze({
    percentiles: Object.freeze(
      Object.fromEntries(PERCENTILE_KEYS.map((key) => [key, points(key)])) as Record<
        PercentileKey,
        readonly ChartPoint[]
      >,
    ),
    totalContributed: points('totalContributed'),
  });
}

export function buildScenarioComparisonChartModel(
  comparison: Readonly<ScenarioComparisonModel>,
): Readonly<ScenarioComparisonChartModel> {
  let observedMaximum = 0;
  for (const checkpoint of comparison.checkpoints) {
    observedMaximum = Math.max(
      observedMaximum,
      checkpoint.values.p95.scenarioA ?? 0,
      checkpoint.values.p95.scenarioB ?? 0,
      checkpoint.values.totalContributed.scenarioA ?? 0,
      checkpoint.values.totalContributed.scenarioB ?? 0,
    );
  }

  const maximumValue = niceMaximum(observedMaximum);
  const xForMonth = (month: number) =>
    FAN_CHART_PLOT.left +
    (month / comparison.finalMonth) * (FAN_CHART_PLOT.right - FAN_CHART_PLOT.left);
  const yForValue = (value: number) =>
    FAN_CHART_PLOT.bottom -
    (value / maximumValue) * (FAN_CHART_PLOT.bottom - FAN_CHART_PLOT.top);
  const xTicks = buildTimeTicks(comparison.finalMonth);
  const checkpointMonths = Object.freeze(
    [
      ...new Set([
        ...xTicks,
        comparison.commonFinalMonth,
        comparison.scenarioAFinalMonth,
        comparison.scenarioBFinalMonth,
      ]),
    ].sort((left, right) => left - right),
  );

  return Object.freeze({
    checkpoints: Object.freeze(
      checkpointMonths.map((month) => exactCheckpoint(comparison.checkpoints, month)),
    ),
    maximumValue,
    scenarioA: series(comparison, 'scenarioA', xForMonth, yForValue),
    scenarioB: series(comparison, 'scenarioB', xForMonth, yForValue),
    xForMonth,
    xTicks,
    yForValue,
    yTicks: Object.freeze([1, 0.75, 0.5, 0.25, 0].map((ratio) => maximumValue * ratio)),
  });
}
