import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';
import {
  SimulationDerivedValueError,
  SimulationNumericalError,
} from '@marketsim/simulation-engine';

import {
  executeSimulationWorkerRequest,
  invalidWorkerRequest,
  isSimulationWorkerRunRequest,
  serializeSimulationError,
} from './simulation-worker-adapter';

const job: SimulationJob = {
  schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
  modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
  seed: '6d2b79f5a4c3e21791f0bc8d457e306a',
  config: {
    initialCapital: 10_000,
    monthlyContribution: 250,
    durationMonths: 12,
    annualExpectedReturn: 0.06,
    annualVolatility: 0.14,
    annualInflation: 0.025,
    simulationCount: 100,
  },
};

describe('simulation worker adapter', () => {
  it('validates and reproduces the same complete result across the boundary', () => {
    const request = { type: 'run', requestId: 'test-1', job } as const;
    const first = executeSimulationWorkerRequest(request, () => 10);
    const second = executeSimulationWorkerRequest(request, () => 10);

    expect(first.type).toBe('completed');
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      metrics: { validationDurationMs: 0, simulationDurationMs: 0 },
    });
    if (first.type === 'completed') {
      expect(first.result.realValues.trajectory).toHaveLength(13);
      expect(first.result.config.annualInflation).toBe(0.025);
    }
  });

  it('returns structured validation details instead of only a message', () => {
    const response = executeSimulationWorkerRequest({
      type: 'run',
      requestId: 'invalid-job',
      job: { ...job, seed: 'invalid' },
    });

    expect(response).toMatchObject({
      type: 'failed',
      requestId: 'invalid-job',
      error: {
        code: 'validation_error',
        message: 'Review the assumptions and try again.',
        technical: { name: 'SimulationValidationError' },
      },
    });
    if (response.type === 'failed') {
      expect(response.error.technical.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'seed' })]),
      );
    }
  });

  it('serializes numerical errors without exposing a stack trace', () => {
    const serialized = serializeSimulationError(new SimulationNumericalError(7, 12));

    expect(serialized).toEqual({
      code: 'numerical_error',
      message: 'The selected assumptions exceeded the supported numeric range.',
      technical: {
        name: 'SimulationNumericalError',
        month: 7,
        pathIndex: 12,
      },
    });
    expect(serialized.technical).not.toHaveProperty('stack');
  });

  it('serializes derived-value failures as structured numerical errors', () => {
    expect(
      serializeSimulationError(new SimulationDerivedValueError(12, 'price index')),
    ).toEqual({
      code: 'numerical_error',
      message: 'The selected assumptions exceeded the supported numeric range.',
      technical: {
        name: 'SimulationDerivedValueError',
        month: 12,
        quantity: 'price index',
      },
    });
  });

  it('rejects malformed protocol messages with a stable response', () => {
    expect(isSimulationWorkerRunRequest({ type: 'run' })).toBe(false);
    expect(invalidWorkerRequest()).toEqual({
      type: 'failed',
      requestId: 'unknown',
      error: {
        code: 'invalid_request',
        message: 'The simulation request could not be read.',
        technical: { reason: 'Request must contain type, requestId, and job.' },
      },
    });
  });
});
