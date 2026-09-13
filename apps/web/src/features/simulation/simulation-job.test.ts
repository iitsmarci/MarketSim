import { describe, expect, it } from 'vitest';

import {
  buildSimulationJob,
  DEFAULT_SIMULATION_SEED,
  initialAssumptions,
} from './simulation-job';

describe('buildSimulationJob', () => {
  it('converts UI years and percentages to explicit domain units', () => {
    const result = buildSimulationJob({
      annualReturn: '7.25',
      horizonYears: '15',
      initialCapital: '12500',
      monthlyContribution: '325',
      simulationCount: '50000',
      volatility: '18.5',
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.job).toMatchObject({
        seed: DEFAULT_SIMULATION_SEED,
        config: {
          initialCapital: 12_500,
          monthlyContribution: 325,
          durationMonths: 180,
          annualExpectedReturn: 0.0725,
          annualVolatility: 0.185,
          simulationCount: 50_000,
        },
      });
    }
  });

  it('maps domain validation issues back to visible assumptions', () => {
    const result = buildSimulationJob({
      ...initialAssumptions,
      annualReturn: '',
      horizonYears: '0',
      simulationCount: '100001',
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toMatchObject({
        annualReturn: expect.any(String),
        horizonYears: expect.any(String),
        simulationCount: expect.any(String),
      });
    }
  });
});
