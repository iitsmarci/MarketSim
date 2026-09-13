export const SIMULATION_JOB_SCHEMA_VERSION = 1 as const;
export const SIMULATION_RESULT_SCHEMA_VERSION = 2 as const;
export const MONTHLY_LOGNORMAL_MODEL_VERSION = 'monthly-lognormal-v1' as const;
export const RANDOMNESS_ALGORITHM_VERSION = 'xoshiro128ss-1.1-box-muller-v1' as const;

/** Four big-endian uint32 words encoded as 32 lowercase hexadecimal digits. */
export type SimulationSeed = string;

export const PERCENTILE_KEYS = [
  'p05',
  'p10',
  'p25',
  'p50',
  'p75',
  'p90',
  'p95',
] as const;

export type PercentileKey = (typeof PERCENTILE_KEYS)[number];

export const PERCENTILE_PROBABILITIES: Readonly<Record<PercentileKey, number>> = {
  p05: 0.05,
  p10: 0.1,
  p25: 0.25,
  p50: 0.5,
  p75: 0.75,
  p90: 0.9,
  p95: 0.95,
};

/** Rates are decimal fractions: 0.07 means 7%, not the number 7. */
export interface SimulationConfig {
  readonly initialCapital: number;
  readonly monthlyContribution: number;
  readonly durationMonths: number;
  readonly annualExpectedReturn: number;
  readonly annualVolatility: number;
  readonly simulationCount: number;
}

/** Serializable execution contract; financial assumptions stay in `config`. */
export interface SimulationJob {
  readonly schemaVersion: typeof SIMULATION_JOB_SCHEMA_VERSION;
  readonly modelVersion: typeof MONTHLY_LOGNORMAL_MODEL_VERSION;
  readonly seed: SimulationSeed;
  readonly config: Readonly<SimulationConfig>;
}

export type PercentileValues = Readonly<Record<PercentileKey, number>>;

export interface DistributionStatistics {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly standardDeviation: number;
  readonly percentiles: PercentileValues;
}

export interface ContributionSummary {
  readonly initialCapital: number;
  readonly periodicContributions: number;
  readonly totalContributions: number;
}

export interface AggregatedTrajectoryPoint {
  /** Zero is the initial state; positive values are completed month-end steps. */
  readonly month: number;
  readonly moneyContributed: number;
  readonly mean: number;
  readonly percentiles: PercentileValues;
}

export interface SimulationResult {
  readonly schemaVersion: typeof SIMULATION_RESULT_SCHEMA_VERSION;
  readonly modelVersion: typeof MONTHLY_LOGNORMAL_MODEL_VERSION;
  readonly randomnessAlgorithm: typeof RANDOMNESS_ALGORITHM_VERSION;
  readonly seed: SimulationSeed;
  readonly config: Readonly<SimulationConfig>;
  readonly contributions: Readonly<ContributionSummary>;
  readonly finalValueStatistics: Readonly<DistributionStatistics>;
  readonly investmentGrowthStatistics: Readonly<DistributionStatistics>;
  readonly trajectory: readonly Readonly<AggregatedTrajectoryPoint>[];
}

export type SimulationConfigField = keyof SimulationConfig;

export type ValidationIssueCode =
  | 'not_finite'
  | 'not_integer'
  | 'below_minimum'
  | 'at_or_below_minimum'
  | 'above_maximum';

export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly field: SimulationConfigField;
  readonly message: string;
  readonly value: number;
}

export type SimulationConfigValidationResult =
  | {
      readonly valid: true;
      readonly value: Readonly<SimulationConfig>;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly ValidationIssue[];
    };

export type SimulationJobField = 'schemaVersion' | 'modelVersion' | 'seed';

export type SimulationJobValidationIssueCode =
  | 'unsupported_schema_version'
  | 'unsupported_model_version'
  | 'invalid_seed_type'
  | 'invalid_seed_format'
  | 'all_zero_seed';

export interface SimulationJobValidationIssue {
  readonly code: SimulationJobValidationIssueCode;
  readonly field: SimulationJobField;
  readonly message: string;
  readonly value: unknown;
}

export type SimulationValidationIssue = ValidationIssue | SimulationJobValidationIssue;

export type SimulationSeedValidationResult =
  | {
      readonly valid: true;
      readonly value: SimulationSeed;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly SimulationJobValidationIssue[];
    };

export type SimulationJobValidationResult =
  | {
      readonly valid: true;
      readonly value: Readonly<SimulationJob>;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly SimulationValidationIssue[];
    };
