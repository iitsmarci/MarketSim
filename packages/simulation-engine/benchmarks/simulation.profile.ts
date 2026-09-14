import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';

import {
  LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
  LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  PERCENTILE_KEYS,
  PERCENTILE_PROBABILITIES,
  SIMULATION_JOB_SCHEMA_VERSION,
  validateSimulationJob,
  type DistributionStatistics,
  type LegacySimulationJob,
  type LegacySimulationResult,
  type SimulationJob,
  type SimulationResult,
} from '@marketsim/domain';
import { describe, expect, it } from 'vitest';

import {
  SeededNormalRandomSource,
  Xoshiro128StarStar,
  annualToMonthlyLognormalParameters,
  calculateDistributionStatistics,
  calculateMonthlyGrowthFactor,
  simulate,
} from '../src/index';

const PROFILE_SEED = '6d2b79f5aa41c83e19d4b760e5279c3a';
const DURATION_MONTHS = 120;
const SAMPLE_COUNTS = [10_000, 50_000, 100_000] as const;
const FULL_RUN_REPETITIONS = 3;
const STAGE_REPETITIONS = 3;

interface TimingSummary {
  readonly averageMs: number;
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly samplesMs: readonly number[];
}

interface MemorySample {
  readonly arrayBuffersDeltaBytes: number;
  readonly heapUsedDeltaBytes: number;
  readonly rssDeltaBytes: number;
}

interface CountProfile {
  readonly simulationCount: number;
  readonly legacyFullSimulation: TimingSummary;
  readonly fullSimulation: TimingSummary;
  readonly inflationOverheadPercent: number;
  readonly memoryDeltas: readonly MemorySample[];
  readonly serializedResultBytes: number;
  readonly stages: {
    readonly validation: TimingSummary;
    readonly rngInitialization: TimingSummary;
    readonly uniformGeneration: TimingSummary;
    readonly normalGeneration: TimingSummary;
    readonly trajectoryEvolution: TimingSummary;
    readonly distributionAggregation: TimingSummary;
    readonly copyAndNumericSort: TimingSummary;
    readonly statisticsAfterSort: TimingSummary;
    readonly temporalAggregation: TimingSummary;
    readonly resultSerialization: TimingSummary;
  };
  readonly memoryModel: {
    readonly liveBalancesBytes: number;
    readonly distributionCopyLowerBoundBytes: number;
    readonly hypotheticalRawPathMatrixBytes: number;
    readonly rawPathsRetained: false;
  };
}

type RuntimeWithGc = typeof globalThis & {
  gc?: () => void;
};

let profilingSink = 0;

function round(value: number): number {
  return Number(value.toFixed(3));
}

function summarize(samples: readonly number[]): TimingSummary {
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);

  return Object.freeze({
    averageMs: round(samples.reduce((sum, sample) => sum + sample, 0) / samples.length),
    medianMs: round(median),
    minMs: round(sorted[0] ?? 0),
    maxMs: round(sorted.at(-1) ?? 0),
    samplesMs: Object.freeze(samples.map(round)),
  });
}

function measure(repetitions: number, operation: () => number): TimingSummary {
  const samples: number[] = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const startedAt = performance.now();
    profilingSink += operation();
    samples.push(performance.now() - startedAt);
  }
  return summarize(samples);
}

function createJob(simulationCount: number): SimulationJob {
  return Object.freeze({
    schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: PROFILE_SEED,
    config: Object.freeze({
      initialCapital: 25_000,
      monthlyContribution: 750,
      durationMonths: DURATION_MONTHS,
      annualExpectedReturn: 0.065,
      annualVolatility: 0.14,
      annualInflation: 0.025,
      simulationCount,
    }),
  });
}

function createLegacyJob(simulationCount: number): LegacySimulationJob {
  return Object.freeze({
    schemaVersion: LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: PROFILE_SEED,
    config: Object.freeze({
      initialCapital: 25_000,
      monthlyContribution: 750,
      durationMonths: DURATION_MONTHS,
      annualExpectedReturn: 0.065,
      annualVolatility: 0.14,
      simulationCount,
    }),
  });
}

function createDistributionValues(count: number): Float64Array {
  const source = new SeededNormalRandomSource(PROFILE_SEED);
  const values = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    values[index] = 100_000 * Math.exp(0.3 * source.nextStandardNormal());
  }
  return values;
}

function statisticsAfterSort(sortedValues: Float64Array): number {
  let mean = 0;
  let sumSquaredDeviations = 0;
  let count = 0;
  for (const value of sortedValues) {
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    sumSquaredDeviations += delta * (value - mean);
  }

  let checksum = mean + Math.sqrt(Math.max(0, sumSquaredDeviations / count));
  for (const key of PERCENTILE_KEYS) {
    const position = (sortedValues.length - 1) * PERCENTILE_PROBABILITIES[key];
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lowerValue = sortedValues[lowerIndex] ?? 0;
    const upperValue = sortedValues[upperIndex] ?? 0;
    checksum += lowerValue * (1 - (position - lowerIndex));
    checksum += upperValue * (position - lowerIndex);
  }
  return checksum;
}

function buildTrajectoryShell(
  durationMonths: number,
  statistics: Readonly<DistributionStatistics>,
): number {
  const trajectory = Array.from({ length: durationMonths + 1 }, (_, month) =>
    Object.freeze({
      month,
      moneyContributed: 25_000 + 750 * month,
      mean: statistics.mean,
      percentiles: statistics.percentiles,
    }),
  );
  return Object.freeze(trajectory).length;
}

function profileCount(simulationCount: number): CountProfile {
  const job = createJob(simulationCount);
  const legacyJob = createLegacyJob(simulationCount);
  const values = createDistributionValues(simulationCount);
  const sortedValues = Float64Array.from(values).sort();
  const statistics = calculateDistributionStatistics(values);
  const randomSamples = simulationCount * DURATION_MONTHS;

  const validation = measure(STAGE_REPETITIONS, () => {
    let validCount = 0;
    for (let iteration = 0; iteration < 1_000; iteration += 1) {
      validCount += validateSimulationJob(job).valid ? 1 : 0;
    }
    return validCount;
  });

  const rngInitialization = measure(STAGE_REPETITIONS, () => {
    let checksum = 0;
    for (let iteration = 0; iteration < 10_000; iteration += 1) {
      checksum += new SeededNormalRandomSource(PROFILE_SEED).nextStandardNormal();
    }
    return checksum;
  });

  const uniformGeneration = measure(STAGE_REPETITIONS, () => {
    const source = new Xoshiro128StarStar(PROFILE_SEED);
    let checksum = 0;
    for (let index = 0; index < randomSamples; index += 1) {
      checksum = (checksum + source.nextUint32()) >>> 0;
    }
    return checksum;
  });

  const normalGeneration = measure(STAGE_REPETITIONS, () => {
    const source = new SeededNormalRandomSource(PROFILE_SEED);
    let checksum = 0;
    for (let index = 0; index < randomSamples; index += 1) {
      checksum += source.nextStandardNormal();
    }
    return checksum;
  });

  const parameters = annualToMonthlyLognormalParameters(
    job.config.annualExpectedReturn,
    job.config.annualVolatility,
  );
  const trajectoryEvolution = measure(STAGE_REPETITIONS, () => {
    const source = new SeededNormalRandomSource(PROFILE_SEED);
    const balances = new Float64Array(simulationCount);
    balances.fill(job.config.initialCapital);
    for (let month = 1; month <= DURATION_MONTHS; month += 1) {
      for (let pathIndex = 0; pathIndex < balances.length; pathIndex += 1) {
        const growthFactor = calculateMonthlyGrowthFactor(
          parameters,
          source.nextStandardNormal(),
        );
        balances[pathIndex] =
          (balances[pathIndex] ?? 0) * growthFactor + job.config.monthlyContribution;
      }
    }
    return balances[balances.length - 1] ?? 0;
  });

  const distributionAggregation = measure(STAGE_REPETITIONS, () => {
    const measured = calculateDistributionStatistics(values);
    return measured.mean + measured.median;
  });

  const copyAndNumericSort = measure(STAGE_REPETITIONS, () => {
    const sorted = Float64Array.from(values).sort();
    return (sorted[0] ?? 0) + (sorted.at(-1) ?? 0);
  });

  const statisticsAfterSorting = measure(STAGE_REPETITIONS, () =>
    statisticsAfterSort(sortedValues),
  );

  const temporalAggregation = measure(100, () =>
    buildTrajectoryShell(DURATION_MONTHS, statistics),
  );

  const runtime = globalThis as RuntimeWithGc;
  const legacyFullSamples: number[] = [];
  const fullSamples: number[] = [];
  const memoryDeltas: MemorySample[] = [];
  let latestResult: Readonly<SimulationResult> | undefined;
  for (let repetition = 0; repetition < FULL_RUN_REPETITIONS; repetition += 1) {
    runtime.gc?.();
    const legacyStartedAt = performance.now();
    const legacyResult: Readonly<LegacySimulationResult> = simulate(legacyJob);
    legacyFullSamples.push(performance.now() - legacyStartedAt);
    profilingSink += legacyResult.finalValueStatistics.mean;

    runtime.gc?.();
    const memoryBefore = process.memoryUsage();
    const startedAt = performance.now();
    latestResult = simulate(job);
    fullSamples.push(performance.now() - startedAt);
    const memoryAfter = process.memoryUsage();
    memoryDeltas.push(
      Object.freeze({
        arrayBuffersDeltaBytes: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
        heapUsedDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
        rssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
      }),
    );
    profilingSink += latestResult.finalValueStatistics.mean;
  }

  if (latestResult === undefined) {
    throw new Error('The full simulation profile did not produce a result.');
  }

  const resultForSerialization = latestResult;
  const resultSerialization = measure(
    STAGE_REPETITIONS,
    () => JSON.stringify(resultForSerialization).length,
  );
  const serializedResultBytes = Buffer.byteLength(
    JSON.stringify(resultForSerialization),
    'utf8',
  );
  const legacyFullSimulation = summarize(legacyFullSamples);
  const fullSimulation = summarize(fullSamples);

  return Object.freeze({
    simulationCount,
    legacyFullSimulation,
    fullSimulation,
    inflationOverheadPercent: round(
      (fullSimulation.medianMs / legacyFullSimulation.medianMs - 1) * 100,
    ),
    memoryDeltas: Object.freeze(memoryDeltas),
    serializedResultBytes,
    stages: Object.freeze({
      validation,
      rngInitialization,
      uniformGeneration,
      normalGeneration,
      trajectoryEvolution,
      distributionAggregation,
      copyAndNumericSort,
      statisticsAfterSort: statisticsAfterSorting,
      temporalAggregation,
      resultSerialization,
    }),
    memoryModel: Object.freeze({
      liveBalancesBytes: simulationCount * Float64Array.BYTES_PER_ELEMENT,
      distributionCopyLowerBoundBytes: simulationCount * Float64Array.BYTES_PER_ELEMENT,
      hypotheticalRawPathMatrixBytes:
        simulationCount * (DURATION_MONTHS + 1) * Float64Array.BYTES_PER_ELEMENT,
      rawPathsRetained: false,
    }),
  });
}

describe('simulation performance profile', () => {
  it('records isolated stage and full-pipeline timings', () => {
    simulate(createLegacyJob(2_000));
    simulate(createJob(2_000));

    const cpuList = cpus();
    const profiles = SAMPLE_COUNTS.map(profileCount);
    const report = Object.freeze({
      profileVersion: 1,
      generatedAt: new Date().toISOString(),
      methodology: Object.freeze({
        durationMonths: DURATION_MONTHS,
        fullRunRepetitions: FULL_RUN_REPETITIONS,
        stageRepetitions: STAGE_REPETITIONS,
        warmup:
          'One legacy and one inflation-aware 2,000-path full simulation with the same 120-month nominal configuration.',
        notes: [
          'Legacy and inflation-aware runs use identical nominal assumptions, duration and seed; the M6 job adds 2.5% deterministic annual inflation.',
          'The legacy run executes the M5 result contract, while the inflation-aware run derives the parallel real-value result after the unchanged nominal pass.',
          'Stage timings intentionally overlap; they explain cost centers and do not sum to the full run.',
          'Memory deltas are post-run observations after explicit pre-run GC, not peak-heap measurements.',
          'Analytical memory values are lower bounds for principal numeric buffers.',
        ],
      }),
      environment: Object.freeze({
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        cpuModel: cpuList[0]?.model ?? 'unknown',
        logicalCpuCount: cpuList.length,
        totalMemoryBytes: totalmem(),
      }),
      profiles,
      profilingSink,
    });

    console.info(
      `MARKETSIM_PROFILE_BEGIN\n${JSON.stringify(report, null, 2)}\nMARKETSIM_PROFILE_END`,
    );

    expect(profiles).toHaveLength(SAMPLE_COUNTS.length);
    expect(profiles.every((profile) => profile.legacyFullSimulation.minMs > 0)).toBe(
      true,
    );
    expect(profiles.every((profile) => profile.fullSimulation.minMs > 0)).toBe(true);
    expect(
      profiles.every((profile) => profile.memoryModel.rawPathsRetained === false),
    ).toBe(true);
  });
});
