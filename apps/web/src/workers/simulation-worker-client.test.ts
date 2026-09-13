import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';
import { simulate } from '@marketsim/simulation-engine';

import { SimulationWorkerClient } from './simulation-worker-client';
import type {
  SimulationWorkerRequest,
  SimulationWorkerResponse,
} from './simulation-worker-protocol';

const job: SimulationJob = {
  schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
  modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
  seed: '6d2b79f5a4c3e21791f0bc8d457e306a',
  config: {
    initialCapital: 10_000,
    monthlyContribution: 250,
    durationMonths: 2,
    annualExpectedReturn: 0.06,
    annualVolatility: 0.14,
    simulationCount: 10,
  },
};

class FakeWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent<SimulationWorkerResponse>) => void) | null = null;
  readonly messages: SimulationWorkerRequest[] = [];

  postMessage(message: SimulationWorkerRequest): void {
    this.messages.push(message);
  }

  terminate(): void {}

  emit(response: SimulationWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<SimulationWorkerResponse>);
  }
}

describe('SimulationWorkerClient performance boundary', () => {
  it('separates startup, validation, engine, request, and response timing', async () => {
    const worker = new FakeWorker();
    let now = 0;
    const client = new SimulationWorkerClient(worker, () => now);

    now = 5;
    worker.emit({ type: 'ready' });
    now = 10;
    const pending = client.run(job);
    const request = worker.messages[0];
    expect(request).toBeDefined();
    if (!request) {
      return;
    }

    now = 12;
    worker.emit({ type: 'accepted', requestId: request.requestId });
    now = 20;
    worker.emit({
      type: 'completed',
      requestId: request.requestId,
      result: simulate(job),
      metrics: { validationDurationMs: 1, simulationDurationMs: 4 },
    });

    await expect(pending).resolves.toMatchObject({
      metrics: {
        workerStartupDurationMs: 5,
        requestDurationMs: 2,
        validationDurationMs: 1,
        simulationDurationMs: 4,
        responseDurationMs: 3,
        boundaryDurationMs: 5,
        totalDurationMs: 10,
      },
    });
  });
});
