import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  PERCENTILE_KEYS,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';
import { simulate } from '@marketsim/simulation-engine';

import { buildScenarioComparison } from './scenario-comparison';
import { buildScenarioComparisonChartModel } from './scenario-comparison-chart-model';

const baseJob: SimulationJob = {
  schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
  modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
  seed: '6d2b79f5a4c3e21791f0bc8d457e306a',
  config: {
    initialCapital: 10_000,
    monthlyContribution: 450,
    durationMonths: 18,
    annualExpectedReturn: 0.065,
    annualVolatility: 0.14,
    annualInflation: 0.025,
    simulationCount: 32,
  },
};

describe('scenario comparison chart model', () => {
  it('uses one scale, the maximum timeline, and an explicit common-horizon checkpoint', () => {
    const resultA = simulate(baseJob);
    const resultB = simulate({
      ...baseJob,
      config: {
        ...baseJob.config,
        durationMonths: 24,
        initialCapital: 18_000,
        monthlyContribution: 700,
        annualExpectedReturn: 0.08,
      },
    });
    const comparison = buildScenarioComparison(resultA, resultB, 'nominal');
    const model = buildScenarioComparisonChartModel(comparison);

    expect(model.xTicks.at(0)).toBe(0);
    expect(model.xTicks.at(-1)).toBe(24);
    expect(model.checkpoints.map((checkpoint) => checkpoint.month)).toContain(18);
    expect(model.scenarioA.totalContributed).toHaveLength(19);
    expect(model.scenarioB.totalContributed).toHaveLength(25);

    for (const key of PERCENTILE_KEYS) {
      expect(model.scenarioA.percentiles[key]).toHaveLength(19);
      expect(model.scenarioB.percentiles[key]).toHaveLength(25);
    }

    expect(model.scenarioA.percentiles.p50[12]?.y).toBe(
      model.yForValue(comparison.checkpoints[12]!.values.p50.scenarioA!),
    );
    expect(model.scenarioB.percentiles.p95[24]?.y).toBe(
      model.yForValue(comparison.checkpoints[24]!.values.p95.scenarioB!),
    );
    expect(model.maximumValue).toBeGreaterThanOrEqual(
      comparison.checkpoints[24]!.values.p95.scenarioB!,
    );
  });
});
