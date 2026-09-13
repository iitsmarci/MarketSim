import type { SimulationJob, SimulationResult } from '@marketsim/domain';

export interface SimulationWorkerRunRequest {
  readonly type: 'run';
  readonly requestId: string;
  readonly job: SimulationJob;
}

export type SimulationWorkerRequest = SimulationWorkerRunRequest;

export interface SimulationWorkerReadyResponse {
  readonly type: 'ready';
}

export interface SimulationWorkerAcceptedResponse {
  readonly type: 'accepted';
  readonly requestId: string;
}

export interface SimulationWorkerMetrics {
  readonly validationDurationMs: number;
  readonly simulationDurationMs: number;
}

export interface SimulationWorkerCompletedResponse {
  readonly type: 'completed';
  readonly requestId: string;
  readonly result: SimulationResult;
  readonly metrics: SimulationWorkerMetrics;
}

export type SimulationWorkerErrorCode =
  | 'invalid_request'
  | 'validation_error'
  | 'numerical_error'
  | 'random_source_error'
  | 'unexpected_error';

export interface SimulationWorkerError {
  readonly code: SimulationWorkerErrorCode;
  readonly message: string;
  readonly technical: Readonly<Record<string, unknown>>;
}

export interface SimulationWorkerFailedResponse {
  readonly type: 'failed';
  readonly requestId: string;
  readonly error: SimulationWorkerError;
}

export type SimulationWorkerResponse =
  | SimulationWorkerReadyResponse
  | SimulationWorkerAcceptedResponse
  | SimulationWorkerCompletedResponse
  | SimulationWorkerFailedResponse;

export interface SimulationRunMetrics extends SimulationWorkerMetrics {
  /** Time from Worker construction until its module is ready to receive jobs. */
  readonly workerStartupDurationMs: number;
  /** Main-thread dispatch through the Worker's accepted acknowledgement. */
  readonly requestDurationMs: number;
  /** Completion payload transfer after measured validation and engine execution. */
  readonly responseDurationMs: number;
  /** Request plus response transfer; excludes measured validation and engine time. */
  readonly boundaryDurationMs: number;
  readonly totalDurationMs: number;
}

export interface SimulationRunResult {
  readonly result: SimulationResult;
  readonly metrics: SimulationRunMetrics;
}
