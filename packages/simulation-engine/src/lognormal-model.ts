export const MONTHS_PER_YEAR = 12 as const;

export interface MonthlyLognormalParameters {
  readonly monthlyLogDrift: number;
  readonly monthlyVolatility: number;
}

/**
 * Converts an effective annual expected simple return and annualized log-return
 * volatility into monthly lognormal parameters.
 */
export function annualToMonthlyLognormalParameters(
  annualExpectedReturn: number,
  annualVolatility: number,
): Readonly<MonthlyLognormalParameters> {
  if (!Number.isFinite(annualExpectedReturn) || annualExpectedReturn <= -1) {
    throw new RangeError('annualExpectedReturn must be finite and greater than -1.');
  }

  if (!Number.isFinite(annualVolatility) || annualVolatility < 0) {
    throw new RangeError('annualVolatility must be finite and non-negative.');
  }

  const monthlyVolatility = annualVolatility / Math.sqrt(MONTHS_PER_YEAR);
  const monthlyLogDrift =
    Math.log1p(annualExpectedReturn) / MONTHS_PER_YEAR - 0.5 * monthlyVolatility ** 2;

  return Object.freeze({ monthlyLogDrift, monthlyVolatility });
}

export function calculateMonthlyGrowthFactor(
  parameters: MonthlyLognormalParameters,
  standardNormal: number,
): number {
  if (!Number.isFinite(standardNormal)) {
    throw new RangeError('standardNormal must be finite.');
  }

  return Math.exp(
    parameters.monthlyLogDrift + parameters.monthlyVolatility * standardNormal,
  );
}
