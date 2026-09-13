import {
  PERCENTILE_KEYS,
  type AggregatedTrajectoryPoint,
  type PercentileKey,
  type SimulationResult,
} from '@marketsim/domain';

export const FAN_CHART_VIEWBOX = Object.freeze({ width: 780, height: 320 });
export const FAN_CHART_PLOT = Object.freeze({
  left: 68,
  right: 748,
  top: 24,
  bottom: 270,
});

export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

export interface FanChartModel {
  readonly maximumValue: number;
  readonly finalMonth: number;
  readonly xTicks: readonly number[];
  readonly yTicks: readonly number[];
  readonly checkpoints: readonly AggregatedTrajectoryPoint[];
  readonly percentilePoints: Readonly<Record<PercentileKey, readonly ChartPoint[]>>;
  readonly contributionPoints: readonly ChartPoint[];
  readonly xForMonth: (month: number) => number;
  readonly yForValue: (value: number) => number;
}

export function niceMaximum(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const ceiling = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return ceiling * magnitude;
}

export function buildTimeTicks(finalMonth: number): readonly number[] {
  const candidateSteps = [1, 2, 3, 6, 12, 24, 36, 60, 120, 240, 300] as const;
  const targetStep = finalMonth / 5;
  const step = candidateSteps.find((candidate) => candidate >= targetStep) ?? 300;
  const ticks: number[] = [];

  for (let month = 0; month <= finalMonth; month += step) {
    ticks.push(month);
  }
  if (ticks.at(-1) !== finalMonth) {
    ticks.push(finalMonth);
  }

  return Object.freeze(ticks);
}

export function nearestTrajectoryPoint(
  trajectory: readonly AggregatedTrajectoryPoint[],
  targetMonth: number,
): AggregatedTrajectoryPoint {
  const first = trajectory[0];
  if (!first) {
    throw new RangeError('A fan chart requires at least one trajectory point.');
  }

  let nearest = first;
  let nearestDistance = Math.abs(first.month - targetMonth);
  for (const point of trajectory) {
    const distance = Math.abs(point.month - targetMonth);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function linePath(points: readonly ChartPoint[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(' ');
}

export function areaPath(
  upper: readonly ChartPoint[],
  lower: readonly ChartPoint[],
): string {
  return `${linePath(upper)} ${[...lower]
    .reverse()
    .map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')} Z`;
}

export function buildFanChartModel(result: SimulationResult): FanChartModel {
  const trajectory = result.trajectory;
  if (trajectory.length < 2) {
    throw new RangeError('A fan chart requires initial and final trajectory points.');
  }

  const finalMonth = trajectory.at(-1)?.month ?? result.config.durationMonths;
  let observedMaximum = 0;
  for (const point of trajectory) {
    observedMaximum = Math.max(
      observedMaximum,
      point.percentiles.p95,
      point.moneyContributed,
    );
  }
  const maximumValue = niceMaximum(observedMaximum);
  const xForMonth = (month: number) =>
    FAN_CHART_PLOT.left +
    (month / finalMonth) * (FAN_CHART_PLOT.right - FAN_CHART_PLOT.left);
  const yForValue = (value: number) =>
    FAN_CHART_PLOT.bottom -
    (value / maximumValue) * (FAN_CHART_PLOT.bottom - FAN_CHART_PLOT.top);

  const percentilePoints = Object.fromEntries(
    PERCENTILE_KEYS.map((key) => [
      key,
      Object.freeze(
        trajectory.map((point) => ({
          x: xForMonth(point.month),
          y: yForValue(point.percentiles[key]),
        })),
      ),
    ]),
  ) as Record<PercentileKey, readonly ChartPoint[]>;
  const xTicks = buildTimeTicks(finalMonth);

  return Object.freeze({
    maximumValue,
    finalMonth,
    xTicks,
    yTicks: Object.freeze([1, 0.75, 0.5, 0.25, 0].map((ratio) => maximumValue * ratio)),
    checkpoints: Object.freeze(
      xTicks.map((month) => nearestTrajectoryPoint(trajectory, month)),
    ),
    percentilePoints: Object.freeze(percentilePoints),
    contributionPoints: Object.freeze(
      trajectory.map((point) => ({
        x: xForMonth(point.month),
        y: yForValue(point.moneyContributed),
      })),
    ),
    xForMonth,
    yForValue,
  });
}
