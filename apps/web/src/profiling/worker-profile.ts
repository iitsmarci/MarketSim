import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
  type SimulationResult,
} from '@marketsim/domain';

import { SimulationWorkerClient } from '../workers/simulation-worker-client';
import type {
  SimulationRunMetrics,
  SimulationRunResult,
} from '../workers/simulation-worker-protocol';

const PROFILE_SEED = '6d2b79f5aa41c83e19d4b760e5279c3a';
const DURATION_MONTHS = 120;
const REPETITIONS = 3;
const COUNTS = [10_000, 50_000, 100_000] as const;

interface TimingSummary {
  readonly averageMs: number;
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly samplesMs: readonly number[];
}

interface BrowserMemory {
  readonly jsHeapSizeLimit: number;
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function summarize(values: readonly number[]): TimingSummary {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    averageMs: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    medianMs: round(sorted[Math.floor(sorted.length / 2)] ?? 0),
    minMs: round(sorted[0] ?? 0),
    maxMs: round(sorted.at(-1) ?? 0),
    samplesMs: values.map(round),
  };
}

function createJob(simulationCount: number): SimulationJob {
  return {
    schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: PROFILE_SEED,
    config: {
      initialCapital: 25_000,
      monthlyContribution: 750,
      durationMonths: DURATION_MONTHS,
      annualExpectedReturn: 0.065,
      annualVolatility: 0.14,
      annualInflation: 0.025,
      simulationCount,
    },
  };
}

function measureClone(value: SimulationJob | SimulationResult): number {
  const startedAt = performance.now();
  const clone = structuredClone(value);
  const duration = performance.now() - startedAt;
  if (!clone) {
    throw new Error('structuredClone did not return a value.');
  }
  return duration;
}

async function runProfile(): Promise<void> {
  const output = document.querySelector<HTMLPreElement>('#profile-output');
  if (!output) {
    throw new Error('Profile output element is missing.');
  }

  const client = new SimulationWorkerClient();
  await client.run(createJob(2_000));
  const profiles = [];

  for (const simulationCount of COUNTS) {
    output.textContent = `Profiling ${simulationCount.toLocaleString('en-IE')} paths…`;
    const jobs = Array.from({ length: REPETITIONS }, () => createJob(simulationCount));
    const runs: SimulationRunResult[] = [];
    for (const job of jobs) {
      runs.push(await client.run(job));
    }

    const metrics = <K extends keyof SimulationRunMetrics>(key: K) =>
      summarize(runs.map((run) => run.metrics[key]));
    const requestClone = summarize(jobs.map((job) => measureClone(job)));
    const resultClone = summarize(runs.map((run) => measureClone(run.result)));
    const result = runs[0]?.result;
    if (!result) {
      throw new Error('Worker profile did not produce a result.');
    }

    profiles.push({
      simulationCount,
      workerStartup: metrics('workerStartupDurationMs'),
      requestDispatch: metrics('requestDurationMs'),
      validation: metrics('validationDurationMs'),
      simulation: metrics('simulationDurationMs'),
      responseTransfer: metrics('responseDurationMs'),
      boundary: metrics('boundaryDurationMs'),
      total: metrics('totalDurationMs'),
      isolatedStructuredClone: {
        request: requestClone,
        result: resultClone,
      },
      serializedResultBytes: new TextEncoder().encode(JSON.stringify(result)).length,
    });
  }

  const memory = (performance as Performance & { memory?: BrowserMemory }).memory;
  const performanceMemory =
    memory &&
    Number.isFinite(memory.jsHeapSizeLimit) &&
    Number.isFinite(memory.totalJSHeapSize) &&
    Number.isFinite(memory.usedJSHeapSize)
      ? {
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          totalJSHeapSize: memory.totalJSHeapSize,
          usedJSHeapSize: memory.usedJSHeapSize,
        }
      : 'not exposed by this browser';
  output.textContent = JSON.stringify(
    {
      profileVersion: 1,
      generatedAt: new Date().toISOString(),
      methodology: {
        durationMonths: DURATION_MONTHS,
        repetitions: REPETITIONS,
        warmup: 'One 2,000-path Worker simulation with the same 120-month assumptions.',
        note: 'Structured-clone timings are isolated local clones; dispatch/response metrics measure the actual Worker boundary.',
      },
      environment: {
        userAgent: navigator.userAgent,
        logicalCpuCount: navigator.hardwareConcurrency,
        performanceMemory,
      },
      profiles,
    },
    null,
    2,
  );
  client.terminate();
}

void runProfile().catch((error: unknown) => {
  const output = document.querySelector<HTMLPreElement>('#profile-output');
  if (output) {
    output.textContent = `Profile failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
});
