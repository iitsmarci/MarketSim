import type {
  SimulationConfig,
  SimulationConfigField,
  SimulationConfigValidationResult,
  ValidationIssue,
  ValidationIssueCode,
} from './contracts';

export const SIMULATION_LIMITS = Object.freeze({
  initialCapital: Object.freeze({ min: 0, max: 1_000_000_000_000 }),
  monthlyContribution: Object.freeze({ min: 0, max: 1_000_000_000 }),
  durationMonths: Object.freeze({ min: 1, max: 1_200 }),
  annualExpectedReturn: Object.freeze({ exclusiveMin: -1, max: 10 }),
  annualVolatility: Object.freeze({ min: 0, max: 5 }),
  simulationCount: Object.freeze({ min: 1, max: 100_000 }),
});

const NO_VALIDATION_ISSUES: readonly [] = Object.freeze([]);

function addIssue(
  issues: ValidationIssue[],
  field: SimulationConfigField,
  code: ValidationIssueCode,
  value: number,
  message: string,
): void {
  issues.push(Object.freeze({ code, field, message, value }));
}

function validateFiniteRange(
  issues: ValidationIssue[],
  field: SimulationConfigField,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isFinite(value)) {
    addIssue(issues, field, 'not_finite', value, `${field} must be a finite number.`);
    return;
  }

  if (value < min) {
    addIssue(
      issues,
      field,
      'below_minimum',
      value,
      `${field} must be at least ${String(min)}.`,
    );
  }

  if (value > max) {
    addIssue(
      issues,
      field,
      'above_maximum',
      value,
      `${field} must be at most ${String(max)}.`,
    );
  }
}

function validateIntegerRange(
  issues: ValidationIssue[],
  field: SimulationConfigField,
  value: number,
  min: number,
  max: number,
): void {
  validateFiniteRange(issues, field, value, min, max);

  if (Number.isFinite(value) && !Number.isInteger(value)) {
    addIssue(issues, field, 'not_integer', value, `${field} must be an integer.`);
  }
}

export function validateSimulationConfig(
  config: SimulationConfig,
): SimulationConfigValidationResult {
  const issues: ValidationIssue[] = [];

  validateFiniteRange(
    issues,
    'initialCapital',
    config.initialCapital,
    SIMULATION_LIMITS.initialCapital.min,
    SIMULATION_LIMITS.initialCapital.max,
  );
  validateFiniteRange(
    issues,
    'monthlyContribution',
    config.monthlyContribution,
    SIMULATION_LIMITS.monthlyContribution.min,
    SIMULATION_LIMITS.monthlyContribution.max,
  );
  validateIntegerRange(
    issues,
    'durationMonths',
    config.durationMonths,
    SIMULATION_LIMITS.durationMonths.min,
    SIMULATION_LIMITS.durationMonths.max,
  );

  if (!Number.isFinite(config.annualExpectedReturn)) {
    addIssue(
      issues,
      'annualExpectedReturn',
      'not_finite',
      config.annualExpectedReturn,
      'annualExpectedReturn must be a finite decimal fraction.',
    );
  } else {
    if (
      config.annualExpectedReturn <= SIMULATION_LIMITS.annualExpectedReturn.exclusiveMin
    ) {
      addIssue(
        issues,
        'annualExpectedReturn',
        'at_or_below_minimum',
        config.annualExpectedReturn,
        'annualExpectedReturn must be greater than -1 (-100%).',
      );
    }

    if (config.annualExpectedReturn > SIMULATION_LIMITS.annualExpectedReturn.max) {
      addIssue(
        issues,
        'annualExpectedReturn',
        'above_maximum',
        config.annualExpectedReturn,
        'annualExpectedReturn must be at most 10 (1,000%).',
      );
    }
  }

  validateFiniteRange(
    issues,
    'annualVolatility',
    config.annualVolatility,
    SIMULATION_LIMITS.annualVolatility.min,
    SIMULATION_LIMITS.annualVolatility.max,
  );
  validateIntegerRange(
    issues,
    'simulationCount',
    config.simulationCount,
    SIMULATION_LIMITS.simulationCount.min,
    SIMULATION_LIMITS.simulationCount.max,
  );

  if (issues.length > 0) {
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }

  return Object.freeze({
    valid: true,
    value: Object.freeze({ ...config }),
    issues: NO_VALIDATION_ISSUES,
  });
}
