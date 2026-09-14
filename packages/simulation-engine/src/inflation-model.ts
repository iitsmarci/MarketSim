import { SIMULATION_LIMITS } from '@marketsim/domain';

import { MONTHS_PER_YEAR } from './lognormal-model';

export interface MonthlyInflationParameters {
  readonly monthlyLogInflation: number;
  readonly monthlyInflationFactor: number;
  readonly monthlyInflation: number;
}

/** Converts an effective annual price-level change to geometric monthly terms. */
export function annualToMonthlyInflationParameters(
  annualInflation: number,
): Readonly<MonthlyInflationParameters> {
  if (
    !Number.isFinite(annualInflation) ||
    annualInflation < SIMULATION_LIMITS.annualInflation.min ||
    annualInflation > SIMULATION_LIMITS.annualInflation.max
  ) {
    throw new RangeError(
      `annualInflation must be finite and from ${String(SIMULATION_LIMITS.annualInflation.min)} to ${String(SIMULATION_LIMITS.annualInflation.max)}.`,
    );
  }

  const monthlyLogInflation = Math.log1p(annualInflation) / MONTHS_PER_YEAR;
  const monthlyInflationFactor = Math.exp(monthlyLogInflation);
  const monthlyInflation = Math.expm1(monthlyLogInflation);

  if (
    !Number.isFinite(monthlyLogInflation) ||
    !Number.isFinite(monthlyInflationFactor) ||
    monthlyInflationFactor <= 0 ||
    !Number.isFinite(monthlyInflation)
  ) {
    throw new RangeError('Inflation conversion exceeded finite numeric range.');
  }

  return Object.freeze({
    monthlyLogInflation,
    monthlyInflationFactor,
    monthlyInflation,
  });
}

/** Month-zero-based deterministic price index, evaluated without iterative drift. */
export function calculatePriceIndex(
  parameters: MonthlyInflationParameters,
  month: number,
): number {
  if (!Number.isInteger(month) || month < 0) {
    throw new RangeError('month must be a non-negative integer.');
  }

  const priceIndex = Math.exp(month * parameters.monthlyLogInflation);
  if (!Number.isFinite(priceIndex) || priceIndex <= 0) {
    throw new RangeError('Price index exceeded finite positive numeric range.');
  }

  return priceIndex;
}
