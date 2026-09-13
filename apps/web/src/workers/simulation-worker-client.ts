import type { SimulationJob } from '@marketsim/domain';

import type {
  SimulationRunResult,
  SimulationWorkerError,
  SimulationWorkerRequest,
  SimulationWorkerResponse,
} from './simulation-worker-protocol';

interface WorkerPort {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<SimulationWorkerResponse>) => void) | null;
  postMessage(message: SimulationWorkerRequest): void;
  terminate(): void;
}

interface PendingRun {
  acceptedAt?: number;
  readonly reject: (reason: SimulationWorkerClientError) => void;
  readonly resolve: (value: SimulationRunResult) => void;
  readonly startedAt: number;
}

export interface SimulationRunner {
  run(job: SimulationJob): Promise<SimulationRunResult>;
  terminate?(): void;
}

export class SimulationWorkerClientError extends Error {
  override readonly name = 'SimulationWorkerClientError';
  readonly payload: SimulationWorkerError;

  constructor(payload: SimulationWorkerError) {
    super(payload.message);
    this.payload = payload;
  }
}

export class SimulationWorkerClient implements SimulationRunner {
  readonly #clock: () => number;
  readonly #pending = new Map<string, PendingRun>();
  readonly #worker: WorkerPort;
  readonly #workerStartedAt: number;
  #requestSequence = 0;
  #workerStartupDurationMs = 0;

  constructor(
    worker: WorkerPort | undefined = undefined,
    clock: () => number = () => performance.now(),
  ) {
    this.#clock = clock;
    this.#workerStartedAt = this.#clock();
    this.#worker =
      worker ??
      new Worker(new URL('./simulation.worker.ts', import.meta.url), {
        name: 'marketsim-simulation',
        type: 'module',
      });
    this.#worker.onmessage = (event) => this.#handleMessage(event.data);
    this.#worker.onerror = () => this.#handleWorkerFailure();
  }

  run(job: SimulationJob): Promise<SimulationRunResult> {
    const requestId = `simulation-${String(++this.#requestSequence)}`;

    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, {
        reject,
        resolve,
        startedAt: this.#clock(),
      });
      this.#worker.postMessage({ type: 'run', requestId, job });
    });
  }

  terminate(): void {
    this.#worker.terminate();
    this.#rejectAll({
      code: 'unexpected_error',
      message: 'The simulation worker was stopped.',
      technical: { name: 'WorkerTerminated' },
    });
  }

  #handleMessage(response: SimulationWorkerResponse): void {
    if (response.type === 'ready') {
      this.#workerStartupDurationMs = Math.max(
        0,
        this.#clock() - this.#workerStartedAt,
      );
      return;
    }

    if (response.type === 'accepted') {
      const pending = this.#pending.get(response.requestId);
      if (pending) {
        pending.acceptedAt = this.#clock();
      }
      return;
    }

    const pending = this.#pending.get(response.requestId);
    if (!pending) {
      return;
    }
    this.#pending.delete(response.requestId);

    if (response.type === 'failed') {
      pending.reject(new SimulationWorkerClientError(response.error));
      return;
    }

    const totalDurationMs = Math.max(0, this.#clock() - pending.startedAt);
    const requestDurationMs = Math.max(
      0,
      (pending.acceptedAt ?? pending.startedAt) - pending.startedAt,
    );
    const responseDurationMs = Math.max(
      0,
      totalDurationMs -
        requestDurationMs -
        response.metrics.validationDurationMs -
        response.metrics.simulationDurationMs,
    );
    pending.resolve({
      result: response.result,
      metrics: {
        simulationDurationMs: response.metrics.simulationDurationMs,
        validationDurationMs: response.metrics.validationDurationMs,
        workerStartupDurationMs: this.#workerStartupDurationMs,
        requestDurationMs,
        responseDurationMs,
        totalDurationMs,
        boundaryDurationMs: requestDurationMs + responseDurationMs,
      },
    });
  }

  #handleWorkerFailure(): void {
    this.#rejectAll({
      code: 'unexpected_error',
      message: 'The simulation worker stopped unexpectedly. Try again.',
      technical: { name: 'WorkerError' },
    });
  }

  #rejectAll(payload: SimulationWorkerError): void {
    for (const pending of this.#pending.values()) {
      pending.reject(new SimulationWorkerClientError(payload));
    }
    this.#pending.clear();
  }
}
