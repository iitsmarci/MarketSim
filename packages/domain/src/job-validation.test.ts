import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationConfig,
  type SimulationJob,
} from './contracts';
import { validateSimulationJob, validateSimulationSeed } from './job-validation';

const validConfig: SimulationConfig = {
  initialCapital: 10_000,
  monthlyContribution: 250,
  durationMonths: 120,
  annualExpectedReturn: 0.06,
  annualVolatility: 0.18,
  simulationCount: 1_000,
};

const validJob: SimulationJob = {
  schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
  modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
  seed: '0123456789abcdeffedcba9876543210',
  config: validConfig,
};

describe('validateSimulationSeed', () => {
  it('accepts and canonicalizes a 128-bit hexadecimal seed', () => {
    const result = validateSimulationSeed('0123456789ABCDEFFEDCBA9876543210');

    expect(result).toEqual({
      valid: true,
      value: '0123456789abcdeffedcba9876543210',
      issues: [],
    });
  });

  it.each([
    [123, 'invalid_seed_type'],
    ['', 'invalid_seed_format'],
    ['0123456789abcdef', 'invalid_seed_format'],
    ['0123456789abcdeffedcba987654321z', 'invalid_seed_format'],
    ['00000000000000000000000000000000', 'all_zero_seed'],
  ] as const)('rejects invalid seed %#', (seed, expectedCode) => {
    const result = validateSimulationSeed(seed);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]?.code).toBe(expectedCode);
    }
  });
});

describe('validateSimulationJob', () => {
  it('returns a frozen normalized job', () => {
    const result = validateSimulationJob({
      ...validJob,
      seed: validJob.seed.toUpperCase(),
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.seed).toBe(validJob.seed);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.config)).toBe(true);
    }
  });

  it('reports metadata and configuration issues together', () => {
    const invalidJob = {
      ...validJob,
      schemaVersion: 99,
      modelVersion: 'unsupported-model',
      seed: 'zero',
      config: { ...validConfig, durationMonths: 0 },
    } as unknown as SimulationJob;
    const result = validateSimulationJob(invalidJob);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.field)).toEqual([
        'schemaVersion',
        'modelVersion',
        'seed',
        'durationMonths',
      ]);
    }
  });
});
