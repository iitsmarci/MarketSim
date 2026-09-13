import {
  executeSimulationWorkerRequest,
  invalidWorkerRequest,
  isSimulationWorkerRunRequest,
  readRequestId,
} from './simulation-worker-adapter';
import type { SimulationWorkerResponse } from './simulation-worker-protocol';

interface SimulationWorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: SimulationWorkerResponse): void;
}

const workerScope = globalThis as unknown as SimulationWorkerScope;

workerScope.postMessage({ type: 'ready' });

workerScope.onmessage = (event) => {
  const request = event.data;
  if (!isSimulationWorkerRunRequest(request)) {
    workerScope.postMessage(invalidWorkerRequest(readRequestId(request)));
    return;
  }

  workerScope.postMessage({
    type: 'accepted',
    requestId: request.requestId,
  });
  workerScope.postMessage(executeSimulationWorkerRequest(request));
};
