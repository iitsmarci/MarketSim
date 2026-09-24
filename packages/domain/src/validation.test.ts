import { describe, expect, it } from 'vitest';

import type { SimulationConfig } from './contracts';
import { SIMULATION_LIMITS, validateSimulationConfig } from './validation';

const validConfig: SimulationConfig = {
  initialCapital: 10_000,
  monthlyContribution: 300,
  durationMonths: 360,
  annualExpectedReturn: 0.06,
  annualVolatility: 0.15,
  annualInflation: 0.025,
  simulationCount: 10_000,
};

describe('validateSimulationConfig', () => {
  it('accepts a finite configuration expressed in monthly and decimal units', () => {
    const result = validateSimulationConfig(validConfig);

    expect(result).toEqual({ valid: true, value: validConfig, issues: [] });
    expect(result).not.toBe(validConfig);
  });

  it.each([
    ['initialCapital', -1, 'below_minimum'],
    ['monthlyContribution', Number.NaN, 'not_finite'],
    ['durationMonths', 1.5, 'not_integer'],
    ['durationMonths', 0, 'below_minimum'],
    ['annualExpectedReturn', -1, 'at_or_below_minimum'],
    ['annualExpectedReturn', 10.1, 'above_maximum'],
    ['annualVolatility', -0.01, 'below_minimum'],
    ['annualInflation', -0.500_001, 'below_minimum'],
    ['annualInflation', 1.000_001, 'above_maximum'],
    ['annualInflation', Number.NaN, 'not_finite'],
    ['annualInflation', Number.POSITIVE_INFINITY, 'not_finite'],
    ['annualInflation', Number.NEGATIVE_INFINITY, 'not_finite'],
    ['simulationCount', 0, 'below_minimum'],
    ['simulationCount', 2.5, 'not_integer'],
  ] as const)('rejects %s=%s with %s', (field, value, code) => {
    const result = validateSimulationConfig({ ...validConfig, [field]: value });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code, field, value })]),
      );
    }
  });

  it('accepts the documented maximum path count', () => {
    const result = validateSimulationConfig({
      ...validConfig,
      simulationCount: SIMULATION_LIMITS.simulationCount.max,
    });

    expect(result.valid).toBe(true);
  });

  it.each([-0.5, 0, 1])('accepts annual inflation boundary value %s', (value) => {
    expect(
      validateSimulationConfig({ ...validConfig, annualInflation: value }).valid,
    ).toBe(true);
  });

  it('reports multiple independent issues in one pass', () => {
    const result = validateSimulationConfig({
      ...validConfig,
      initialCapital: Number.POSITIVE_INFINITY,
      monthlyContribution: -1_000_000_001,
      durationMonths: 0,
      annualVolatility: -1,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.field)).toEqual([
        'initialCapital',
        'monthlyContribution',
        'durationMonths',
        'annualVolatility',
      ]);
    }
  });
});
