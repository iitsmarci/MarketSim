import { describe, expect, it } from 'vitest';

import {
  LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
  LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  PERCENTILE_KEYS,
  SIMULATION_JOB_SCHEMA_VERSION,
  type LegacySimulationJob,
  type SimulationConfig,
  type SimulationJob,
} from '@marketsim/domain';

import type { NormalRandomSource } from './random';
import { simulate, simulateWithRandomSource } from './simulate';

const SEED = '0123456789abcdeffedcba9876543210';

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
      throw new Error('Controlled normal source exhausted.');
    }
    this.#index += 1;
    return value;
  }
}

const baseConfig: SimulationConfig = {
  initialCapital: 10_000,
  monthlyContribution: 250,
  durationMonths: 24,
  annualExpectedReturn: 0.065,
  annualVolatility: 0.14,
  annualInflation: 0.025,
  simulationCount: 25,
};

function job(overrides: Partial<SimulationConfig> = {}): SimulationJob {
  return {
    schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: SEED,
    config: { ...baseConfig, ...overrides },
  };
}

function legacyJob(config: SimulationConfig): LegacySimulationJob {
  return {
    schemaVersion: LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: SEED,
    config: {
      initialCapital: config.initialCapital,
      monthlyContribution: config.monthlyContribution,
      durationMonths: config.durationMonths,
      annualExpectedReturn: config.annualExpectedReturn,
      annualVolatility: config.annualVolatility,
      simulationCount: config.simulationCount,
    },
  };
}

describe('inflation and real-value simulation', () => {
  it('makes every real aggregate equal its nominal aggregate at zero inflation', () => {
    const result = simulate(job({ annualInflation: 0 }));

    expect(result.realValues.finalValueStatistics).toEqual(result.finalValueStatistics);
    expect(result.realValues.investmentGrowthStatistics).toEqual(
      result.investmentGrowthStatistics,
    );
    expect(result.realValues.contributions).toEqual(result.contributions);
    expect(
      result.realValues.trajectory.map(({ priceIndex, ...point }) => ({
        priceIndex,
        point,
      })),
    ).toEqual(result.trajectory.map((point) => ({ priceIndex: 1, point })));
  });

  it('deflates constant capital when return and contributions are zero', () => {
    const annualInflation = 0.12;
    const result = simulate(
      job({
        annualInflation,
        annualExpectedReturn: 0,
        annualVolatility: 0,
        monthlyContribution: 0,
        simulationCount: 1,
      }),
    );

    for (const point of result.realValues.trajectory) {
      const expectedPriceIndex = (1 + annualInflation) ** (point.month / 12);
      expect(point.priceIndex).toBeCloseTo(expectedPriceIndex, 13);
      expect(point.percentiles.p50).toBeCloseTo(
        baseConfig.initialCapital / expectedPriceIndex,
        10,
      );
    }
  });

  it('deflates a known initial-capital-only path', () => {
    const config = {
      annualExpectedReturn: 0.08,
      annualVolatility: 0,
      annualInflation: 0.03,
      monthlyContribution: 0,
      simulationCount: 1,
    };
    const result = simulate(job(config));
    const final = result.realValues.trajectory.at(-1);
    const nominalMonthlyGrowth = (1 + config.annualExpectedReturn) ** (1 / 12);
    const inflationMonthlyGrowth = (1 + config.annualInflation) ** (1 / 12);

    expect(final?.percentiles.p50).toBeCloseTo(
      baseConfig.initialCapital *
        (nominalMonthlyGrowth / inflationMonthlyGrowth) ** baseConfig.durationMonths,
      10,
    );
  });

  it('keeps contributions nominally fixed and deflates each payment separately', () => {
    const config = {
      initialCapital: 1_000,
      monthlyContribution: 100,
      durationMonths: 3,
      annualExpectedReturn: 0,
      annualVolatility: 0,
      annualInflation: 0.12,
      simulationCount: 1,
    };
    const result = simulate(job(config));
    let expectedRealContributions = config.initialCapital;

    for (let month = 1; month <= config.durationMonths; month += 1) {
      const nominalPoint = result.trajectory[month];
      const realPoint = result.realValues.trajectory[month];
      const priceIndex = (1 + config.annualInflation) ** (month / 12);
      expectedRealContributions += config.monthlyContribution / priceIndex;

      expect(nominalPoint?.moneyContributed).toBe(
        config.initialCapital + month * config.monthlyContribution,
      );
      expect(realPoint?.moneyContributed).toBeCloseTo(expectedRealContributions, 12);
    }

    const incorrectlyDeflatedTotal =
      (config.initialCapital + config.durationMonths * config.monthlyContribution) /
      (1 + config.annualInflation) ** (config.durationMonths / 12);
    expect(result.realValues.contributions.totalContributions).not.toBeCloseTo(
      incorrectlyDeflatedTotal,
      8,
    );
  });

  it('supports bounded deflation with positive finite price indexes', () => {
    const result = simulate(
      job({
        annualInflation: -0.1,
        annualExpectedReturn: 0,
        annualVolatility: 0,
        monthlyContribution: 0,
        simulationCount: 1,
      }),
    );

    for (const point of result.realValues.trajectory) {
      expect(point.priceIndex).toBeGreaterThan(0);
      expect(Number.isFinite(point.priceIndex)).toBe(true);
      expect(Number.isFinite(point.percentiles.p50)).toBe(true);
      if (point.month > 0) {
        expect(point.percentiles.p50).toBeGreaterThan(
          result.trajectory[point.month]?.percentiles.p50 ?? Number.POSITIVE_INFINITY,
        );
      }
    }
  });

  it('scales every percentile and population deviation by the price index', () => {
    const result = simulate(job());

    result.realValues.trajectory.forEach((realPoint, index) => {
      const nominalPoint = result.trajectory[index];
      expect(nominalPoint).toBeDefined();
      for (const key of PERCENTILE_KEYS) {
        expect(realPoint.percentiles[key]).toBe(
          (nominalPoint?.percentiles[key] ?? 0) * (1 / realPoint.priceIndex),
        );
      }
    });

    const terminalPriceIndex = result.realValues.trajectory.at(-1)?.priceIndex ?? 1;
    expect(result.realValues.finalValueStatistics.standardDeviation).toBe(
      result.finalValueStatistics.standardDeviation * (1 / terminalPriceIndex),
    );
  });

  it.each([-0.5, 1])(
    'keeps the 1,200-month price index finite at annual inflation %s',
    (annualInflation) => {
      const result = simulate(
        job({
          durationMonths: 1_200,
          annualInflation,
          annualExpectedReturn: 0,
          annualVolatility: 0,
          monthlyContribution: 0,
          simulationCount: 1,
        }),
      );
      const final = result.realValues.trajectory.at(-1);

      const expectedPriceIndex = (1 + annualInflation) ** 100;
      expect((final?.priceIndex ?? 0) / expectedPriceIndex).toBeCloseTo(1, 12);
      expect(Number.isFinite(final?.percentiles.p50)).toBe(true);
    },
  );

  it('reproduces the complete real and nominal result for the same seeded job', () => {
    const simulationJob = job();
    expect(simulate(simulationJob)).toEqual(simulate(simulationJob));
    expect(
      simulate(JSON.parse(JSON.stringify(simulationJob)) as SimulationJob),
    ).toEqual(simulate(simulationJob));
  });

  it('keeps different seeds divergent in nominal and real trajectories', () => {
    const first = simulate(job());
    const second = simulate({
      ...job(),
      seed: 'fedcba98765432100123456789abcdef',
    });

    expect(first.trajectory).not.toEqual(second.trajectory);
    expect(first.realValues.trajectory).not.toEqual(second.realValues.trajectory);
  });

  it('preserves the legacy nominal result bit-for-bit at zero inflation', () => {
    const newJob = job({ annualInflation: 0 });
    const legacy = simulate(legacyJob(newJob.config));
    const current = simulate(newJob);

    expect(current.contributions).toEqual(legacy.contributions);
    expect(current.finalValueStatistics).toEqual(legacy.finalValueStatistics);
    expect(current.investmentGrowthStatistics).toEqual(
      legacy.investmentGrowthStatistics,
    );
    expect(current.trajectory).toEqual(legacy.trajectory);
  });

  it('does not add or reorder random consumption', () => {
    const config = {
      ...baseConfig,
      durationMonths: 2,
      simulationCount: 3,
      annualInflation: 0,
    };
    const samples = [-1, 0, 1, 0.25, -0.25, 0.5];
    const legacySource = new ControlledNormalSource(samples);
    const currentSource = new ControlledNormalSource(samples);
    const legacy = simulateWithRandomSource(legacyJob(config), legacySource);
    const current = simulateWithRandomSource(job(config), currentSource);

    expect(legacySource.calls).toBe(6);
    expect(currentSource.calls).toBe(6);
    expect(current.trajectory).toEqual(legacy.trajectory);
    expect(current.finalValueStatistics).toEqual(legacy.finalValueStatistics);
  });
});
