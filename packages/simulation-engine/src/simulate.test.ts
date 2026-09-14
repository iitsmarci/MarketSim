import { describe, expect, it } from 'vitest';

import {
  LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
  LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
  LEGACY_SIMULATION_RESULT_SCHEMA_VERSION,
  PERCENTILE_KEYS,
  type LegacySimulationConfig,
  type LegacySimulationJob,
} from '@marketsim/domain';

import { InvalidRandomSampleError, SimulationValidationError } from './errors';
import {
  annualToMonthlyLognormalParameters,
  calculateMonthlyGrowthFactor,
} from './lognormal-model';
import type { NormalRandomSource } from './random';
import { simulateWithRandomSource } from './simulate';

class ControlledNormalSource implements NormalRandomSource {
  readonly #values: readonly number[];
  #index = 0;

  constructor(values: readonly number[]) {
    this.#values = values;
  }

  get calls(): number {
    return this.#index;
  }

  nextStandardNormal(): number {
    const value = this.#values[this.#index];
    if (value === undefined) {
      throw new Error('Controlled normal source was exhausted.');
    }
    this.#index += 1;
    return value;
  }
}

class FailingNormalSource implements NormalRandomSource {
  nextStandardNormal(): number {
    throw new Error('Random source must not be called.');
  }
}

const baseConfig: LegacySimulationConfig = {
  initialCapital: 1_000,
  monthlyContribution: 100,
  durationMonths: 12,
  annualExpectedReturn: 0.06,
  annualVolatility: 0,
  simulationCount: 5,
};
const TEST_SEED = '00000001000000020000000300000004';

function config(
  overrides: Partial<LegacySimulationConfig> = {},
): LegacySimulationConfig {
  return { ...baseConfig, ...overrides };
}

function job(input: LegacySimulationConfig): LegacySimulationJob {
  return {
    schemaVersion: LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: TEST_SEED,
    config: input,
  };
}

function simulate(
  input: LegacySimulationConfig,
  options: { readonly randomSource: NormalRandomSource },
) {
  return simulateWithRandomSource(job(input), options.randomSource);
}

function deterministicBalance(input: LegacySimulationConfig): number {
  const monthlyGrowth = (1 + input.annualExpectedReturn) ** (1 / 12);
  let balance = input.initialCapital;

  for (let month = 0; month < input.durationMonths; month += 1) {
    balance = balance * monthlyGrowth + input.monthlyContribution;
  }

  return balance;
}

describe('simulate', () => {
  it('does not consume randomness and makes every path equal at zero volatility', () => {
    const input = config();
    const result = simulate(input, { randomSource: new FailingNormalSource() });
    const expected = deterministicBalance(input);

    expect(result.schemaVersion).toBe(LEGACY_SIMULATION_RESULT_SCHEMA_VERSION);
    expect(result.modelVersion).toBe(LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION);
    expect(result.seed).toBe(TEST_SEED);
    expect(result.finalValueStatistics.min).toBeCloseTo(expected, 10);
    expect(result.finalValueStatistics.max).toBeCloseTo(expected, 10);
    expect(result.finalValueStatistics.standardDeviation).toBe(0);
    expect(result.finalValueStatistics.percentiles.p05).toBeCloseTo(expected, 10);
    expect(result.finalValueStatistics.percentiles.p95).toBeCloseTo(expected, 10);
  });

  it('adds contributions after return and follows the zero-return closed form', () => {
    const input = config({
      initialCapital: 250,
      monthlyContribution: 75,
      durationMonths: 4,
      annualExpectedReturn: 0,
      simulationCount: 1,
    });
    const result = simulate(input, { randomSource: new FailingNormalSource() });

    expect(result.finalValueStatistics.median).toBe(550);
    expect(result.contributions).toEqual({
      initialCapital: 250,
      periodicContributions: 300,
      totalContributions: 550,
    });
    expect(result.investmentGrowthStatistics.median).toBe(0);
  });

  it('supports contribution-only accumulation', () => {
    const result = simulate(
      config({
        initialCapital: 0,
        monthlyContribution: 50,
        durationMonths: 6,
        annualExpectedReturn: 0,
        simulationCount: 3,
      }),
      { randomSource: new FailingNormalSource() },
    );

    expect(result.finalValueStatistics.median).toBe(300);
    expect(result.contributions.totalContributions).toBe(300);
  });

  it('supports initial capital only with deterministic annual compounding', () => {
    const result = simulate(
      config({
        initialCapital: 2_000,
        monthlyContribution: 0,
        durationMonths: 12,
        annualExpectedReturn: 0.1,
        simulationCount: 2,
      }),
      { randomSource: new FailingNormalSource() },
    );

    expect(result.finalValueStatistics.median).toBeCloseTo(2_200, 10);
    expect(result.contributions.totalContributions).toBe(2_000);
    expect(result.investmentGrowthStatistics.median).toBeCloseTo(200, 10);
  });

  it('applies one stochastic period using the supplied standard-normal value', () => {
    const source = new ControlledNormalSource([0]);
    const input = config({
      initialCapital: 500,
      monthlyContribution: 25,
      durationMonths: 1,
      annualExpectedReturn: 0.08,
      annualVolatility: 0.2,
      simulationCount: 1,
    });
    const parameters = annualToMonthlyLognormalParameters(0.08, 0.2);
    const expected = 500 * calculateMonthlyGrowthFactor(parameters, 0) + 25;
    const result = simulate(input, { randomSource: source });

    expect(source.calls).toBe(1);
    expect(result.finalValueStatistics.median).toBeCloseTo(expected, 12);
    for (const key of PERCENTILE_KEYS) {
      expect(result.finalValueStatistics.percentiles[key]).toBeCloseTo(expected, 12);
    }
  });

  it('uses month-major random consumption over multiple periods', () => {
    const samples = [-1, 1, -0.5, 0.5] as const;
    const source = new ControlledNormalSource(samples);
    const input = config({
      initialCapital: 100,
      monthlyContribution: 10,
      durationMonths: 2,
      annualExpectedReturn: 0.04,
      annualVolatility: 0.24,
      simulationCount: 2,
    });
    const parameters = annualToMonthlyLognormalParameters(0.04, 0.24);
    const afterFirstPath0 =
      100 * calculateMonthlyGrowthFactor(parameters, samples[0]) + 10;
    const afterFirstPath1 =
      100 * calculateMonthlyGrowthFactor(parameters, samples[1]) + 10;
    const expectedPath0 =
      afterFirstPath0 * calculateMonthlyGrowthFactor(parameters, samples[2]) + 10;
    const expectedPath1 =
      afterFirstPath1 * calculateMonthlyGrowthFactor(parameters, samples[3]) + 10;
    const result = simulate(input, { randomSource: source });

    expect(source.calls).toBe(4);
    expect(result.finalValueStatistics.min).toBeCloseTo(expectedPath0, 12);
    expect(result.finalValueStatistics.max).toBeCloseTo(expectedPath1, 12);
    expect(result.trajectory).toHaveLength(3);
    expect(result.trajectory.map((point) => point.moneyContributed)).toEqual([
      100, 110, 120,
    ]);
  });

  it('returns ordered percentile trajectories for controlled outcomes', () => {
    const source = new ControlledNormalSource([-2, -1, -0.5, 0, 0.5, 1, 2]);
    const result = simulate(
      config({
        initialCapital: 100,
        monthlyContribution: 0,
        durationMonths: 1,
        annualVolatility: 0.3,
        simulationCount: 7,
      }),
      { randomSource: source },
    );
    const values = PERCENTILE_KEYS.map(
      (key) => result.finalValueStatistics.percentiles[key],
    );

    expect(values).toEqual([...values].sort((left, right) => left - right));
    expect(result.trajectory[0]?.percentiles.p50).toBe(100);
    expect(result.trajectory[1]?.percentiles).toEqual(
      result.finalValueStatistics.percentiles,
    );
  });

  it('is deterministic when supplied equivalent controlled random sources', () => {
    const input = config({
      durationMonths: 2,
      annualVolatility: 0.1,
      simulationCount: 3,
    });
    const samples = [-1, 0, 1, 0.25, -0.25, 0.5];

    const first = simulate(input, {
      randomSource: new ControlledNormalSource(samples),
    });
    const second = simulate(input, {
      randomSource: new ControlledNormalSource(samples),
    });

    expect(first).toEqual(second);
  });

  it('rejects invalid configurations before consuming randomness', () => {
    const source = new ControlledNormalSource([0]);

    expect(() =>
      simulate(config({ durationMonths: 0, annualVolatility: -1 }), {
        randomSource: source,
      }),
    ).toThrow(SimulationValidationError);
    expect(source.calls).toBe(0);
  });

  it('rejects a non-finite value from the randomness boundary', () => {
    expect(() =>
      simulate(
        config({ durationMonths: 1, annualVolatility: 0.1, simulationCount: 1 }),
        { randomSource: new ControlledNormalSource([Number.NaN]) },
      ),
    ).toThrow(InvalidRandomSampleError);
  });
});
