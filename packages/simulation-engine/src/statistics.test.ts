import { describe, expect, it } from 'vitest';

import {
  calculateDistributionStatistics,
  calculatePercentile,
  scaleDistributionStatistics,
  shiftDistributionStatistics,
} from './statistics';

describe('calculatePercentile', () => {
  it('uses Type 7 linear interpolation', () => {
    const values = [0, 10, 20, 30];

    expect(calculatePercentile(values, 0)).toBe(0);
    expect(calculatePercentile(values, 0.25)).toBe(7.5);
    expect(calculatePercentile(values, 0.5)).toBe(15);
    expect(calculatePercentile(values, 0.95)).toBeCloseTo(28.5, 12);
    expect(calculatePercentile(values, 1)).toBe(30);
    expect(values).toEqual([0, 10, 20, 30]);
  });

  it('returns the only value for every probability', () => {
    expect(calculatePercentile([42], 0.05)).toBe(42);
    expect(calculatePercentile([42], 0.95)).toBe(42);
  });

  it.each([
    [[], 0.5],
    [[1, Number.NaN], 0.5],
    [[1], -0.01],
    [[1], 1.01],
  ] as const)('rejects invalid values or probability %#', (values, probability) => {
    expect(() => calculatePercentile(values, probability)).toThrow(RangeError);
  });
});

describe('calculateDistributionStatistics', () => {
  it('calculates population statistics and ordered required percentiles', () => {
    const statistics = calculateDistributionStatistics([3, 1, 2]);
    const ordered = Object.values(statistics.percentiles);

    expect(statistics).toMatchObject({ min: 1, max: 3, mean: 2, median: 2 });
    expect(statistics.standardDeviation).toBeCloseTo(Math.sqrt(2 / 3), 12);
    expect(ordered).toEqual([...ordered].sort((left, right) => left - right));
  });

  it('shifts location statistics without changing dispersion', () => {
    const statistics = calculateDistributionStatistics([10, 20, 30]);
    const shifted = shiftDistributionStatistics(statistics, -15);

    expect(shifted.min).toBe(-5);
    expect(shifted.max).toBe(15);
    expect(shifted.median).toBe(5);
    expect(shifted.standardDeviation).toBe(statistics.standardDeviation);
    expect(shifted.percentiles.p50).toBe(5);
  });

  it('rejects distributions whose aggregate statistics overflow', () => {
    expect(() =>
      calculateDistributionStatistics([Number.MAX_VALUE, -Number.MAX_VALUE]),
    ).toThrow('Distribution statistics exceed finite numeric range.');
  });

  it('scales every location and dispersion statistic by a positive factor', () => {
    const statistics = calculateDistributionStatistics([10, 20, 30]);
    expect(scaleDistributionStatistics(statistics, 0.5)).toEqual({
      min: 5,
      max: 15,
      mean: 10,
      median: 10,
      standardDeviation: statistics.standardDeviation * 0.5,
      percentiles: Object.fromEntries(
        Object.entries(statistics.percentiles).map(([key, value]) => [
          key,
          value * 0.5,
        ]),
      ),
    });
  });

  it('rejects invalid or overflowing distribution scales', () => {
    const statistics = calculateDistributionStatistics([1, 2, 3]);
    expect(() => scaleDistributionStatistics(statistics, 0)).toThrow(RangeError);
    expect(() => scaleDistributionStatistics(statistics, Number.NaN)).toThrow(
      RangeError,
    );
    expect(() =>
      scaleDistributionStatistics(
        calculateDistributionStatistics([Number.MAX_VALUE]),
        2,
      ),
    ).toThrow('Scaled distribution statistics exceed finite numeric range.');
  });

  it('preserves the legacy numeric-array result after the typed-array optimization', () => {
    const values = Float64Array.from(
      { length: 2_003 },
      (_, index) =>
        Math.exp(Math.sin(index * 0.731) + Math.cos(index * 0.113)) * 10_000,
    );
    const legacySorted = Array.from(values).sort((left, right) => left - right);
    let mean = 0;
    let sumSquaredDeviations = 0;
    let count = 0;
    for (const value of legacySorted) {
      count += 1;
      const delta = value - mean;
      mean += delta / count;
      sumSquaredDeviations += delta * (value - mean);
    }
    const percentile = (probability: number) => {
      const position = (legacySorted.length - 1) * probability;
      const lowerIndex = Math.floor(position);
      const upperIndex = Math.ceil(position);
      const lower = legacySorted[lowerIndex] ?? 0;
      const upper = legacySorted[upperIndex] ?? 0;
      const weight = position - lowerIndex;
      return lower * (1 - weight) + upper * weight;
    };

    expect(calculateDistributionStatistics(values)).toEqual({
      min: legacySorted[0],
      max: legacySorted.at(-1),
      mean,
      median: percentile(0.5),
      standardDeviation: Math.sqrt(sumSquaredDeviations / count),
      percentiles: {
        p05: percentile(0.05),
        p10: percentile(0.1),
        p25: percentile(0.25),
        p50: percentile(0.5),
        p75: percentile(0.75),
        p90: percentile(0.9),
        p95: percentile(0.95),
      },
    });
  });
});
