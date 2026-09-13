import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  RANDOMNESS_ALGORITHM_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';

import { SimulationNumericalError, SimulationValidationError } from './errors';
import type { NormalRandomSource } from './random';
import { simulate, simulateWithRandomSource } from './simulate';

const FIRST_SEED = '0123456789abcdeffedcba9876543210';
const SECOND_SEED = '0123456789abcdeffedcba9876543211';

function job(seed: string = FIRST_SEED): SimulationJob {
  return {
    schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed,
    config: {
      initialCapital: 25_000,
      monthlyContribution: 400,
      durationMonths: 36,
      annualExpectedReturn: 0.065,
      annualVolatility: 0.2,
      simulationCount: 750,
    },
  };
}

class ExtremeFiniteNormalSource implements NormalRandomSource {
  nextStandardNormal(): number {
    return Number.MAX_VALUE;
  }
}

describe('seeded simulation reproducibility', () => {
  it('returns the same complete result for the same seed, config, and model', () => {
    const first = simulate(job());
    const second = simulate(job());

    expect(second).toEqual(first);
    expect(first.seed).toBe(FIRST_SEED);
    expect(first.randomnessAlgorithm).toBe(RANDOMNESS_ALGORITHM_VERSION);
  });

  it('changes trajectories and statistics when the seed changes', () => {
    const first = simulate(job(FIRST_SEED));
    const second = simulate(job(SECOND_SEED));

    expect(second.trajectory).not.toEqual(first.trajectory);
    expect(second.finalValueStatistics).not.toEqual(first.finalValueStatistics);
  });

  it('reproduces percentile and statistics output independently', () => {
    const first = simulate(job());
    const second = simulate(job());

    expect(second.finalValueStatistics.percentiles).toEqual(
      first.finalValueStatistics.percentiles,
    );
    expect(second.finalValueStatistics).toEqual(first.finalValueStatistics);
    expect(second.investmentGrowthStatistics).toEqual(first.investmentGrowthStatistics);
  });

  it('reproduces a simulation after the job is serialized and reloaded', () => {
    const originalJob = job();
    const reloadedJob = JSON.parse(JSON.stringify(originalJob)) as SimulationJob;

    expect(simulate(reloadedJob)).toEqual(simulate(originalJob));
  });

  it('canonicalizes an uppercase serialized seed in the result', () => {
    const uppercaseJob = job(FIRST_SEED.toUpperCase());

    expect(simulate(uppercaseJob)).toEqual(simulate(job(FIRST_SEED)));
  });

  it('rejects an invalid job instead of using fallback randomness', () => {
    const invalidJob = { ...job(), seed: 'invalid' };

    expect(() => simulate(invalidJob)).toThrow(SimulationValidationError);
  });

  it('throws on numeric overflow instead of returning a corrupted result', () => {
    expect(() =>
      simulateWithRandomSource(
        {
          ...job(),
          config: {
            ...job().config,
            durationMonths: 1,
            simulationCount: 1,
          },
        },
        new ExtremeFiniteNormalSource(),
      ),
    ).toThrow(SimulationNumericalError);
  });
});
