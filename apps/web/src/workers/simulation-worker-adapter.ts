import { validateSimulationJob } from '@marketsim/domain';
import {
  InvalidRandomSampleError,
  SimulationDerivedValueError,
  SimulationNumericalError,
  SimulationValidationError,
  simulate,
} from '@marketsim/simulation-engine';

import type {
  SimulationWorkerCompletedResponse,
  SimulationWorkerError,
  SimulationWorkerFailedResponse,
  SimulationWorkerRunRequest,
} from './simulation-worker-protocol';

type Clock = () => number;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

export function isSimulationWorkerRunRequest(
  value: unknown,
): value is SimulationWorkerRunRequest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === 'run' &&
    typeof value.requestId === 'string' &&
    value.requestId.length > 0 &&
    isRecord(value.job)
  );
}

export function invalidWorkerRequest(
  requestId = 'unknown',
): SimulationWorkerFailedResponse {
  return {
    type: 'failed',
    requestId,
    error: {
      code: 'invalid_request',
      message: 'The simulation request could not be read.',
      technical: { reason: 'Request must contain type, requestId, and job.' },
    },
  };
}

export function serializeSimulationError(error: unknown): SimulationWorkerError {
  if (error instanceof SimulationValidationError) {
    return {
      code: 'validation_error',
      message: 'Review the assumptions and try again.',
      technical: { name: error.name, issues: error.issues },
    };
  }

  if (error instanceof SimulationNumericalError) {
    return {
      code: 'numerical_error',
      message: 'The selected assumptions exceeded the supported numeric range.',
      technical: {
        name: error.name,
        month: error.month,
        pathIndex: error.pathIndex,
      },
    };
  }

  if (error instanceof SimulationDerivedValueError) {
    return {
      code: 'numerical_error',
      message: 'The selected assumptions exceeded the supported numeric range.',
      technical: {
        name: error.name,
        month: error.month,
        quantity: error.quantity,
      },
    };
  }

  if (error instanceof InvalidRandomSampleError) {
    return {
      code: 'random_source_error',
      message: 'The simulation random source produced an invalid value.',
      technical: {
        name: error.name,
        month: error.month,
        pathIndex: error.pathIndex,
      },
    };
  }

  return {
    code: 'unexpected_error',
    message: 'The simulation could not be completed. Try again.',
    technical: {
      name: error instanceof Error ? error.name : 'UnknownError',
    },
  };
}

export function executeSimulationWorkerRequest(
  request: SimulationWorkerRunRequest,
  clock: Clock = () => performance.now(),
): SimulationWorkerCompletedResponse | SimulationWorkerFailedResponse {
  try {
    const validationStartedAt = clock();
    const validation = validateSimulationJob(request.job);
    if (!validation.valid) {
      throw new SimulationValidationError(validation.issues);
    }
    const validationDurationMs = Math.max(0, clock() - validationStartedAt);

    const startedAt = clock();
    const result = simulate(validation.value);
    const simulationDurationMs = Math.max(0, clock() - startedAt);

    return {
      type: 'completed',
      requestId: request.requestId,
      result,
      metrics: { simulationDurationMs, validationDurationMs },
    };
  } catch (error) {
    return {
      type: 'failed',
      requestId: request.requestId,
      error: serializeSimulationError(error),
    };
  }
}

export function readRequestId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return typeof value.requestId === 'string' ? value.requestId : undefined;
}
