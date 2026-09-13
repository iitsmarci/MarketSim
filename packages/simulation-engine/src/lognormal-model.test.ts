import { describe, expect, it } from 'vitest';

import {
  MONTHS_PER_YEAR,
  annualToMonthlyLognormalParameters,
  calculateMonthlyGrowthFactor,
} from './lognormal-model';

describe('monthly lognormal parameter conversion', () => {
  it('preserves the annual expected growth factor', () => {
    const annualExpectedReturn = 0.07;
    const annualVolatility = 0.18;
    const parameters = annualToMonthlyLognormalParameters(
      annualExpectedReturn,
      annualVolatility,
    );
    const expectedMonthlyGrowth = Math.exp(
      parameters.monthlyLogDrift + 0.5 * parameters.monthlyVolatility ** 2,
    );

    expect(parameters.monthlyVolatility).toBeCloseTo(
      annualVolatility / Math.sqrt(MONTHS_PER_YEAR),
      15,
    );
    expect(expectedMonthlyGrowth ** MONTHS_PER_YEAR).toBeCloseTo(
      1 + annualExpectedReturn,
      14,
    );
  });

  it('reduces to deterministic effective monthly compounding at zero volatility', () => {
    const parameters = annualToMonthlyLognormalParameters(0.12, 0);

    expect(calculateMonthlyGrowthFactor(parameters, -4)).toBeCloseTo(
      1.12 ** (1 / 12),
      15,
    );
    expect(calculateMonthlyGrowthFactor(parameters, 4)).toBeCloseTo(
      1.12 ** (1 / 12),
      15,
    );
  });

  it.each([
    [-1, 0],
    [Number.NaN, 0],
    [0.05, -0.01],
    [0.05, Number.POSITIVE_INFINITY],
  ])('rejects invalid annual parameters %#', (annualReturn, annualVolatility) => {
    expect(() =>
      annualToMonthlyLognormalParameters(annualReturn, annualVolatility),
    ).toThrow(RangeError);
  });
});
