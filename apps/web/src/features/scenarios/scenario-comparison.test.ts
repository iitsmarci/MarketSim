import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  PERCENTILE_KEYS,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';
import { simulate } from '@marketsim/simulation-engine';

import {
  COMPARISON_METRIC_KEYS,
  buildScenarioComparison,
  buildScenarioPair,
  initialScenarioComparisonSettings,
  scenarioAInitialAssumptions,
  scenarioBInitialAssumptions,
} from './scenario-comparison';

const seed = '6d2b79f5a4c3e21791f0bc8d457e306a';

function job(overrides: Partial<SimulationJob['config']>): SimulationJob {
  return {
    schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed,
    config: {
      initialCapital: 10_000,
      monthlyContribution: 450,
      durationMonths: 12,
      annualExpectedReturn: 0.065,
      annualVolatility: 0.14,
      annualInflation: 0.025,
      simulationCount: 32,
      ...overrides,
    },
  };
}

describe('scenario comparison presenter', () => {
  it('builds independent scenario horizons with explicit shared controls', () => {
    const pair = buildScenarioPair(
      { ...scenarioAInitialAssumptions, horizonYears: '15' },
      {
        ...scenarioBInitialAssumptions,
        annualReturn: '8',
        horizonYears: '22',
        initialCapital: '25000',
      },
      { ...initialScenarioComparisonSettings, simulationCount: '50000' },
    );

    expect(pair.a.valid).toBe(true);
    expect(pair.b.valid).toBe(true);
    if (!pair.a.valid || !pair.b.valid) {
      return;
    }

    expect(pair.a.job.config).toMatchObject({
      durationMonths: 180,
      simulationCount: 50_000,
    });
    expect(pair.b.job.config).toMatchObject({
      annualExpectedReturn: 0.08,
      durationMonths: 264,
      initialCapital: 25_000,
      simulationCount: 50_000,
    });
    expect(pair.b.job.seed).toBe(pair.a.job.seed);
    expect(pair.b.job.modelVersion).toBe(pair.a.job.modelVersion);
  });

  it('preserves independent scenario errors and shared path-count validation', () => {
    const pair = buildScenarioPair(
      { ...scenarioAInitialAssumptions, horizonYears: '0' },
      { ...scenarioBInitialAssumptions, annualReturn: 'not-a-number' },
      { ...initialScenarioComparisonSettings, simulationCount: '0' },
    );

    expect(pair.a).toMatchObject({
      valid: false,
      errors: {
        horizonYears: expect.any(String),
        simulationCount: expect.any(String),
      },
    });
    expect(pair.b).toMatchObject({
      valid: false,
      errors: {
        annualReturn: expect.any(String),
        simulationCount: expect.any(String),
      },
    });
  });

  it('uses the maximum timeline and marks the ended scenario unavailable', () => {
    const resultA = simulate(job({ durationMonths: 6 }));
    const resultB = simulate(
      job({
        durationMonths: 12,
        initialCapital: 15_000,
        monthlyContribution: 700,
      }),
    );
    const comparison = buildScenarioComparison(resultA, resultB, 'nominal');

    expect(comparison).toMatchObject({
      commonFinalMonth: 6,
      finalMonth: 12,
      scenarioAFinalMonth: 6,
      scenarioBFinalMonth: 12,
    });
    expect(comparison.checkpoints).toHaveLength(13);
    expect(comparison.checkpoints[6]?.values.p50.delta).toBe(
      resultB.trajectory[6]!.percentiles.p50 - resultA.trajectory[6]!.percentiles.p50,
    );
    expect(comparison.checkpoints[7]?.values.p50).toEqual({
      scenarioA: undefined,
      scenarioB: resultB.trajectory[7]!.percentiles.p50,
      delta: undefined,
    });
  });

  it('calculates all seven quantile deltas as B minus A at the same checkpoint', () => {
    const resultA = simulate(job({}));
    const resultB = simulate(
      job({
        initialCapital: 15_000,
        monthlyContribution: 700,
        annualExpectedReturn: 0.08,
        annualInflation: 0.04,
      }),
    );

    for (const mode of ['nominal', 'real'] as const) {
      const comparison = buildScenarioComparison(resultA, resultB, mode);
      const sourceA =
        mode === 'real' ? resultA.realValues.trajectory : resultA.trajectory;
      const sourceB =
        mode === 'real' ? resultB.realValues.trajectory : resultB.trajectory;

      comparison.checkpoints.forEach((checkpoint, index) => {
        const pointA = sourceA[index]!;
        const pointB = sourceB[index]!;
        expect(checkpoint.values.totalContributed).toEqual({
          scenarioA: pointA.moneyContributed,
          scenarioB: pointB.moneyContributed,
          delta: pointB.moneyContributed - pointA.moneyContributed,
        });
        for (const key of PERCENTILE_KEYS) {
          expect(checkpoint.values[key]).toEqual({
            scenarioA: pointA.percentiles[key],
            scenarioB: pointB.percentiles[key],
            delta: pointB.percentiles[key] - pointA.percentiles[key],
          });
        }
      });
    }
  });

  it('keeps the required metric order and reproduces the complete comparison', () => {
    const jobA = job({ durationMonths: 9 });
    const jobB = job({
      annualExpectedReturn: 0.08,
      durationMonths: 15,
      monthlyContribution: 700,
    });
    const first = buildScenarioComparison(simulate(jobA), simulate(jobB), 'real');
    const repeated = buildScenarioComparison(simulate(jobA), simulate(jobB), 'real');

    expect(COMPARISON_METRIC_KEYS).toEqual(['totalContributed', ...PERCENTILE_KEYS]);
    expect(repeated).toEqual(first);
  });

  it('preserves the common seeded prefix when only the horizon differs', () => {
    const shortResult = simulate(job({ durationMonths: 6 }));
    const longResult = simulate(job({ durationMonths: 12 }));

    expect(shortResult.trajectory).toEqual(longResult.trajectory.slice(0, 7));
    expect(shortResult.realValues.trajectory).toEqual(
      longResult.realValues.trajectory.slice(0, 7),
    );
  });

  it('rejects a missing monthly checkpoint instead of interpolating it', () => {
    const resultA = simulate(job({}));
    const completeResultB = simulate(job({ monthlyContribution: 700 }));
    const resultB = {
      ...completeResultB,
      trajectory: completeResultB.trajectory.filter((point) => point.month !== 6),
    };

    expect(() => buildScenarioComparison(resultA, resultB, 'nominal')).toThrow(
      /every exact monthly checkpoint/i,
    );
  });

  it('requires shared seed, model, and path count but allows different horizons', () => {
    const resultA = simulate(job({ durationMonths: 6 }));
    const resultWithDifferentHorizon = simulate(job({ durationMonths: 12 }));
    const resultWithDifferentSeed = simulate({
      ...job({ durationMonths: 12 }),
      seed: '11111111111111111111111111111111',
    });
    const resultWithDifferentCount = simulate(job({ simulationCount: 16 }));

    expect(() =>
      buildScenarioComparison(resultA, resultWithDifferentHorizon, 'nominal'),
    ).not.toThrow();
    expect(() =>
      buildScenarioComparison(resultA, resultWithDifferentSeed, 'nominal'),
    ).toThrow(/same seed, model, and simulation count/i);
    expect(() =>
      buildScenarioComparison(resultA, resultWithDifferentCount, 'nominal'),
    ).toThrow(/same seed, model, and simulation count/i);
  });
});
