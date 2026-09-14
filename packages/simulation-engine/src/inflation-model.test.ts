import { describe, expect, it } from 'vitest';

import {
  annualToMonthlyInflationParameters,
  calculatePriceIndex,
} from './inflation-model';

describe('deterministic inflation conversion', () => {
  it.each([-0.5, -0.02, 0, 0.025, 1])(
    'preserves the effective annual price change for %s',
    (annualInflation) => {
      const parameters = annualToMonthlyInflationParameters(annualInflation);

      expect((1 + parameters.monthlyInflation) ** 12).toBeCloseTo(
        1 + annualInflation,
        14,
      );
      expect(parameters.monthlyInflationFactor).toBeCloseTo(
        (1 + annualInflation) ** (1 / 12),
        15,
      );
    },
  );

  it('uses an exact neutral index at zero inflation', () => {
    const parameters = annualToMonthlyInflationParameters(0);

    expect(parameters).toEqual({
      monthlyLogInflation: 0,
      monthlyInflationFactor: 1,
      monthlyInflation: 0,
    });
    expect(calculatePriceIndex(parameters, 0)).toBe(1);
    expect(calculatePriceIndex(parameters, 1_200)).toBe(1);
  });

  it('matches the independent annual price-index formula at key checkpoints', () => {
    const annualInflation = 0.037;
    const parameters = annualToMonthlyInflationParameters(annualInflation);

    for (const month of [0, 1, 12, 137, 1_200]) {
      const theoretical = (1 + annualInflation) ** (month / 12);
      expect(calculatePriceIndex(parameters, month) / theoretical).toBeCloseTo(1, 13);
    }
  });

  it.each([
    -0.500_001,
    1.000_001,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects unsupported annual inflation %s', (annualInflation) => {
    expect(() => annualToMonthlyInflationParameters(annualInflation)).toThrow(
      RangeError,
    );
  });

  it.each([-1, 0.5, Number.NaN])('rejects invalid checkpoint month %s', (month) => {
    const parameters = annualToMonthlyInflationParameters(0.02);
    expect(() => calculatePriceIndex(parameters, month)).toThrow(RangeError);
  });
});
