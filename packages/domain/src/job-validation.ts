import {
  LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
  LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type LegacySimulationJob,
  type LegacySimulationJobValidationResult,
  type SimulationJob,
  type SimulationJobValidationIssue,
  type SimulationJobValidationIssueCode,
  type SimulationJobValidationResult,
  type SimulationSeedValidationResult,
  type SimulationValidationIssue,
  type SupportedSimulationJob,
  type SupportedSimulationJobValidationResult,
} from './contracts';
import { validateLegacySimulationConfig, validateSimulationConfig } from './validation';

export const SIMULATION_SEED_HEX_LENGTH = 32 as const;

const SEED_PATTERN = /^[0-9a-fA-F]{32}$/;
const ALL_ZERO_SEED_PATTERN = /^0{32}$/;
const NO_VALIDATION_ISSUES: readonly [] = Object.freeze([]);

function jobIssue(
  field: SimulationJobValidationIssue['field'],
  code: SimulationJobValidationIssueCode,
  value: unknown,
  message: string,
): Readonly<SimulationJobValidationIssue> {
  return Object.freeze({ code, field, message, value });
}

export function normalizeSimulationSeed(seed: string): string {
  return seed.toLowerCase();
}

export function validateSimulationSeed(seed: unknown): SimulationSeedValidationResult {
  const issues: SimulationJobValidationIssue[] = [];

  if (typeof seed !== 'string') {
    issues.push(
      jobIssue('seed', 'invalid_seed_type', seed, 'seed must be a hexadecimal string.'),
    );
  } else if (!SEED_PATTERN.test(seed)) {
    issues.push(
      jobIssue(
        'seed',
        'invalid_seed_format',
        seed,
        `seed must contain exactly ${String(SIMULATION_SEED_HEX_LENGTH)} hexadecimal digits.`,
      ),
    );
  } else if (ALL_ZERO_SEED_PATTERN.test(seed)) {
    issues.push(
      jobIssue(
        'seed',
        'all_zero_seed',
        seed,
        'seed must not encode the all-zero xoshiro128** state.',
      ),
    );
  }

  if (issues.length > 0 || typeof seed !== 'string') {
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }

  return Object.freeze({
    valid: true,
    value: normalizeSimulationSeed(seed),
    issues: NO_VALIDATION_ISSUES,
  });
}

export function validateSimulationJob(
  job: SimulationJob,
): SimulationJobValidationResult {
  const issues: SimulationValidationIssue[] = [];

  if (job.schemaVersion !== SIMULATION_JOB_SCHEMA_VERSION) {
    issues.push(
      jobIssue(
        'schemaVersion',
        'unsupported_schema_version',
        job.schemaVersion,
        `schemaVersion must be ${String(SIMULATION_JOB_SCHEMA_VERSION)}.`,
      ),
    );
  }

  if (job.modelVersion !== MONTHLY_LOGNORMAL_MODEL_VERSION) {
    issues.push(
      jobIssue(
        'modelVersion',
        'unsupported_model_version',
        job.modelVersion,
        `modelVersion must be ${MONTHLY_LOGNORMAL_MODEL_VERSION}.`,
      ),
    );
  }

  const seedValidation = validateSimulationSeed(job.seed);
  if (!seedValidation.valid) {
    issues.push(...seedValidation.issues);
  }

  const configValidation = validateSimulationConfig(job.config);
  if (!configValidation.valid) {
    issues.push(...configValidation.issues);
  }

  if (issues.length > 0 || !configValidation.valid || !seedValidation.valid) {
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }

  return Object.freeze({
    valid: true,
    value: Object.freeze({
      schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
      modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
      seed: seedValidation.value,
      config: configValidation.value,
    }),
    issues: NO_VALIDATION_ISSUES,
  });
}

export function validateLegacySimulationJob(
  job: LegacySimulationJob,
): LegacySimulationJobValidationResult {
  const issues: SimulationValidationIssue[] = [];

  if (job.schemaVersion !== LEGACY_SIMULATION_JOB_SCHEMA_VERSION) {
    issues.push(
      jobIssue(
        'schemaVersion',
        'unsupported_schema_version',
        job.schemaVersion,
        `schemaVersion must be ${String(LEGACY_SIMULATION_JOB_SCHEMA_VERSION)} for ${LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION}.`,
      ),
    );
  }

  if (job.modelVersion !== LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION) {
    issues.push(
      jobIssue(
        'modelVersion',
        'unsupported_model_version',
        job.modelVersion,
        `modelVersion must be ${LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION}.`,
      ),
    );
  }

  const seedValidation = validateSimulationSeed(job.seed);
  if (!seedValidation.valid) {
    issues.push(...seedValidation.issues);
  }

  const configIssues = validateLegacySimulationConfig(job.config);
  issues.push(...configIssues);

  if (issues.length > 0 || !seedValidation.valid) {
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }

  return Object.freeze({
    valid: true,
    value: Object.freeze({
      schemaVersion: LEGACY_SIMULATION_JOB_SCHEMA_VERSION,
      modelVersion: LEGACY_MONTHLY_LOGNORMAL_MODEL_VERSION,
      seed: seedValidation.value,
      config: Object.freeze({ ...job.config }),
    }),
    issues: NO_VALIDATION_ISSUES,
  });
}

export function validateSupportedSimulationJob(
  job: SupportedSimulationJob,
): SupportedSimulationJobValidationResult {
  if (job.schemaVersion === LEGACY_SIMULATION_JOB_SCHEMA_VERSION) {
    return validateLegacySimulationJob(job as LegacySimulationJob);
  }

  return validateSimulationJob(job as SimulationJob);
}
