import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  PERCENTILE_KEYS,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';
import { simulate } from '@marketsim/simulation-engine';

import {
  buildFanChartModel,
  buildTimeTicks,
  nearestTrajectoryPoint,
} from './fan-chart-model';

const job: SimulationJob = {
  schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
  modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
  seed: '6d2b79f5a4c3e21791f0bc8d457e306a',
  config: {
    initialCapital: 10_000,
    monthlyContribution: 450,
    durationMonths: 24,
    annualExpectedReturn: 0.065,
    annualVolatility: 0.14,
    simulationCount: 64,
  },
};

describe('fan chart quantitative model', () => {
  it('maps every plotted percentile directly from the simulation trajectory', () => {
    const result = simulate(job);
    const model = buildFanChartModel(result);
    const sourcePoint = result.trajectory[13];

    expect(sourcePoint).toBeDefined();
    if (!sourcePoint) {
      return;
    }

    for (const key of PERCENTILE_KEYS) {
      expect(model.percentilePoints[key][13]).toEqual({
        x: model.xForMonth(sourcePoint.month),
        y: model.yForValue(sourcePoint.percentiles[key]),
      });
    }
    expect(model.contributionPoints[13]?.y).toBe(
      model.yForValue(sourcePoint.moneyContributed),
    );
  });

  it('keeps all seven percentile lines ordered throughout time', () => {
    const result = simulate(job);

    for (const point of result.trajectory) {
      const values = PERCENTILE_KEYS.map((key) => point.percentiles[key]);
      expect(values).toEqual([...values].sort((left, right) => left - right));
    }
  });

  it.each([
    [12, [0, 3, 6, 9, 12]],
    [180, [0, 36, 72, 108, 144, 180]],
    [240, [0, 60, 120, 180, 240]],
    [480, [0, 120, 240, 360, 480]],
  ] as const)(
    'builds legible adaptive ticks for a %i-month horizon',
    (months, expected) => {
      expect(buildTimeTicks(months)).toEqual(expected);
    },
  );

  it('uses compact adaptive checkpoints instead of dumping every month', () => {
    const result = simulate(job);
    const model = buildFanChartModel(result);

    expect(model.checkpoints.map((point) => point.month)).toEqual(model.xTicks);
    expect(model.checkpoints.length).toBeLessThan(result.trajectory.length);
  });

  it('selects the nearest real monthly point for data inspection', () => {
    const result = simulate(job);

    expect(nearestTrajectoryPoint(result.trajectory, 7.6).month).toBe(8);
    expect(nearestTrajectoryPoint(result.trajectory, -4).month).toBe(0);
    expect(nearestTrajectoryPoint(result.trajectory, 100).month).toBe(24);
  });
});
