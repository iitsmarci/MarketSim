import { describe, expect, it } from 'vitest';

import { BoxMullerNormalSource } from './box-muller';
import type { Uint32RandomSource } from './random';
import { SeededNormalRandomSource } from './seeded-normal-source';

const VECTOR_SEED = '00000001000000020000000300000004';

class ControlledUint32Source implements Uint32RandomSource {
  readonly #values: readonly number[];
  #index = 0;

  constructor(values: readonly number[]) {
    this.#values = values;
  }

  get calls(): number {
    return this.#index;
  }

  nextUint32(): number {
    const value = this.#values[this.#index];
    if (value === undefined) {
      throw new Error('Controlled uint32 source was exhausted.');
    }
    this.#index += 1;
    return value;
  }
}

describe('BoxMullerNormalSource', () => {
  it('matches the committed Box-Muller vector and cached-value order', () => {
    const source = new SeededNormalRandomSource(VECTOR_SEED);
    const expected = [
      5.065338378002493, 3.7050875453928183e-9, 3.6097754234450994, 0.3753262585564832,
      -0.8982257880349771, 0.8308495722255658,
    ];

    for (const expectedValue of expected) {
      expect(source.nextStandardNormal()).toBeCloseTo(expectedValue, 12);
    }
  });

  it('consumes two uniform words for each pair of normal values', () => {
    const uniformSource = new ControlledUint32Source([1, 2, 3, 4]);
    const normalSource = new BoxMullerNormalSource(uniformSource);

    normalSource.nextStandardNormal();
    expect(uniformSource.calls).toBe(2);
    normalSource.nextStandardNormal();
    expect(uniformSource.calls).toBe(2);
    normalSource.nextStandardNormal();
    expect(uniformSource.calls).toBe(4);
  });

  it('stays finite at both uniform endpoints and reaches a far tail', () => {
    const source = new BoxMullerNormalSource(
      new ControlledUint32Source([0, 0x8000_0000, 0xffff_ffff, 0xffff_ffff]),
    );
    const values = Array.from({ length: 4 }, () => source.nextStandardNormal());

    expect(values.every(Number.isFinite)).toBe(true);
    expect(values[0]).toBeLessThan(-6.7);
  });

  it('rejects an invalid integer from the uniform boundary', () => {
    const source = new BoxMullerNormalSource(
      new ControlledUint32Source([Number.NaN, 0]),
    );

    expect(() => source.nextStandardNormal()).toThrow(RangeError);
  });

  it('has robust deterministic standard-normal sanity statistics', () => {
    const source = new SeededNormalRandomSource('0123456789abcdeffedcba9876543210');
    const sampleSize = 200_000;
    let mean = 0;
    let sumSquaredDeviations = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let allFinite = true;

    for (let count = 1; count <= sampleSize; count += 1) {
      const value = source.nextStandardNormal();
      allFinite = allFinite && Number.isFinite(value);
      min = Math.min(min, value);
      max = Math.max(max, value);
      const delta = value - mean;
      mean += delta / count;
      sumSquaredDeviations += delta * (value - mean);
    }

    const standardDeviation = Math.sqrt(sumSquaredDeviations / sampleSize);
    expect(allFinite).toBe(true);
    expect(Math.abs(mean)).toBeLessThan(0.01);
    expect(standardDeviation).toBeGreaterThan(0.99);
    expect(standardDeviation).toBeLessThan(1.01);
    expect(min).toBeLessThan(-4);
    expect(max).toBeGreaterThan(4);
  });
});
