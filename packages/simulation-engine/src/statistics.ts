import {
  PERCENTILE_KEYS,
  PERCENTILE_PROBABILITIES,
  type DistributionStatistics,
  type PercentileValues,
} from '@marketsim/domain';

type NumericValues = ArrayLike<number>;

function copyFiniteValues(values: NumericValues): Float64Array {
  if (!Number.isInteger(values.length) || values.length < 1) {
    throw new RangeError('At least one value is required.');
  }

  const copy = new Float64Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined || !Number.isFinite(value)) {
      throw new RangeError(`Value at index ${String(index)} must be finite.`);
    }
    copy[index] = value;
  }

  return copy;
}

function typeSevenQuantile(sortedValues: NumericValues, probability: number): number {
  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];

  if (lowerValue === undefined || upperValue === undefined) {
    throw new RangeError('Quantile index is outside the supplied values.');
  }

  const upperWeight = position - lowerIndex;
  return lowerValue * (1 - upperWeight) + upperValue * upperWeight;
}

function percentilesFromSorted(sortedValues: NumericValues): PercentileValues {
  const percentiles = Object.fromEntries(
    PERCENTILE_KEYS.map((key) => [
      key,
      typeSevenQuantile(sortedValues, PERCENTILE_PROBABILITIES[key]),
    ]),
  ) as Record<(typeof PERCENTILE_KEYS)[number], number>;

  return Object.freeze(percentiles);
}

export function calculatePercentile(
  values: NumericValues,
  probability: number,
): number {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError('probability must be a finite number from 0 to 1.');
  }

  const sortedValues = copyFiniteValues(values).sort();
  return typeSevenQuantile(sortedValues, probability);
}

export function calculateDistributionStatistics(
  values: NumericValues,
): Readonly<DistributionStatistics> {
  const sortedValues = copyFiniteValues(values).sort();

  let mean = 0;
  let sumSquaredDeviations = 0;
  let count = 0;

  for (const value of sortedValues) {
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    sumSquaredDeviations += delta * (value - mean);
  }

  const percentiles = percentilesFromSorted(sortedValues);
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];

  if (min === undefined || max === undefined) {
    throw new RangeError('At least one value is required.');
  }

  const variance = Math.max(0, sumSquaredDeviations / count);
  const standardDeviation = Math.sqrt(variance);
  if (!Number.isFinite(mean) || !Number.isFinite(standardDeviation)) {
    throw new RangeError('Distribution statistics exceed finite numeric range.');
  }

  return Object.freeze({
    min,
    max,
    mean,
    median: percentiles.p50,
    standardDeviation,
    percentiles,
  });
}

export function shiftDistributionStatistics(
  statistics: DistributionStatistics,
  offset: number,
): Readonly<DistributionStatistics> {
  if (!Number.isFinite(offset)) {
    throw new RangeError('offset must be finite.');
  }

  const shiftedPercentiles = Object.fromEntries(
    PERCENTILE_KEYS.map((key) => [key, statistics.percentiles[key] + offset]),
  ) as Record<(typeof PERCENTILE_KEYS)[number], number>;

  return Object.freeze({
    min: statistics.min + offset,
    max: statistics.max + offset,
    mean: statistics.mean + offset,
    median: statistics.median + offset,
    standardDeviation: statistics.standardDeviation,
    percentiles: Object.freeze(shiftedPercentiles),
  });
}

export function scaleDistributionStatistics(
  statistics: DistributionStatistics,
  scale: number,
): Readonly<DistributionStatistics> {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('scale must be a finite positive number.');
  }

  const scaledPercentiles = Object.fromEntries(
    PERCENTILE_KEYS.map((key) => [key, statistics.percentiles[key] * scale]),
  ) as Record<(typeof PERCENTILE_KEYS)[number], number>;
  const scaled = {
    min: statistics.min * scale,
    max: statistics.max * scale,
    mean: statistics.mean * scale,
    median: statistics.median * scale,
    standardDeviation: statistics.standardDeviation * scale,
    percentiles: Object.freeze(scaledPercentiles),
  };

  if (
    !Number.isFinite(scaled.min) ||
    !Number.isFinite(scaled.max) ||
    !Number.isFinite(scaled.mean) ||
    !Number.isFinite(scaled.median) ||
    !Number.isFinite(scaled.standardDeviation) ||
    PERCENTILE_KEYS.some((key) => !Number.isFinite(scaled.percentiles[key]))
  ) {
    throw new RangeError('Scaled distribution statistics exceed finite numeric range.');
  }

  return Object.freeze(scaled);
}
