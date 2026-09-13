import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';

import { simulate } from './simulate';

const CONVERGENCE_SEED = '3f84d5b5b5470917c85abc61e10e3148';

function theoreticalExpectedFinalValue(job: SimulationJob): number {
  const config = job.config;
  const expectedMonthlyGrowth = (1 + config.annualExpectedReturn) ** (1 / 12);
  const compoundedGrowth = expectedMonthlyGrowth ** config.durationMonths;

  if (expectedMonthlyGrowth === 1) {
    return config.initialCapital + config.monthlyContribution * config.durationMonths;
  }

  return (
    config.initialCapital * compoundedGrowth +
    config.monthlyContribution * ((compoundedGrowth - 1) / (expectedMonthlyGrowth - 1))
  );
}

describe('Monte Carlo expectation convergence', () => {
  it(
    'converges to the implemented monthly-model expectation within five standard errors',
    { timeout: 15_000 },
    () => {
      const job: SimulationJob = {
        schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
        modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
        seed: CONVERGENCE_SEED,
        config: {
          initialCapital: 10_000,
          monthlyContribution: 250,
          durationMonths: 12,
          annualExpectedReturn: 0.07,
          annualVolatility: 0.18,
          simulationCount: 100_000,
        },
      };
      const result = simulate(job);
      const theoreticalMean = theoreticalExpectedFinalValue(job);
      const empiricalMean = result.finalValueStatistics.mean;
      const standardError =
        result.finalValueStatistics.standardDeviation /
        Math.sqrt(job.config.simulationCount);
      const tolerance = 5 * standardError + theoreticalMean * Number.EPSILON;

      expect(Math.abs(empiricalMean - theoreticalMean)).toBeLessThan(tolerance);
    },
  );
});
