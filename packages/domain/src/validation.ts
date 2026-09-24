import type {
  LegacySimulationConfig,
  SimulationConfig,
  SimulationConfigField,
  SimulationConfigValidationResult,
  ValidationIssue,
  ValidationIssueCode,
} from './contracts';

export const SIMULATION_LIMITS = Object.freeze({
  initialCapital: Object.freeze({ min: 0, max: 1_000_000_000_000 }),
  monthlyContribution: Object.freeze({ min: -1_000_000_000, max: 1_000_000_000 }),
  durationMonths: Object.freeze({ min: 1, max: 1_200 }),
  annualExpectedReturn: Object.freeze({ exclusiveMin: -1, max: 10 }),
  annualVolatility: Object.freeze({ min: 0, max: 5 }),
  annualInflation: Object.freeze({ min: -0.5, max: 1 }),
  simulationCount: Object.freeze({ min: 1, max: 100_000 }),
  annualCosts: Object.freeze({ min: 0, max: 1 }),
  marketShockFrequency: Object.freeze({ min: 0, max: 12 }),
  marketShockMagnitude: Object.freeze({ min: -1, max: 10 }),
  stockAllocation: Object.freeze({ min: 0, max: 1 }),
  bondAnnualExpectedReturn: Object.freeze({ exclusiveMin: -1, max: 10 }),
  bondAnnualVolatility: Object.freeze({ min: 0, max: 5 }),
  stockBondCorrelation: Object.freeze({ min: -1, max: 1 }),
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

function validateLegacyFields(config: LegacySimulationConfig): ValidationIssue[] {
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

  return issues;
}

export function validateLegacySimulationConfig(
  config: LegacySimulationConfig,
): readonly ValidationIssue[] {
  return Object.freeze(validateLegacyFields(config));
}

export function validateSimulationConfig(
  config: SimulationConfig,
): SimulationConfigValidationResult {
  const issues = validateLegacyFields(config);

  validateFiniteRange(
    issues,
    'annualInflation',
    config.annualInflation,
    SIMULATION_LIMITS.annualInflation.min,
    SIMULATION_LIMITS.annualInflation.max,
  );

  if (config.annualCosts !== undefined) {
    validateFiniteRange(
      issues,
      'annualCosts',
      config.annualCosts,
      SIMULATION_LIMITS.annualCosts.min,
      SIMULATION_LIMITS.annualCosts.max,
    );
  }

  if (config.marketShockFrequency !== undefined) {
    validateFiniteRange(
      issues,
      'marketShockFrequency',
      config.marketShockFrequency,
      SIMULATION_LIMITS.marketShockFrequency.min,
      SIMULATION_LIMITS.marketShockFrequency.max,
    );
  }

  if (config.marketShockMagnitude !== undefined) {
    validateFiniteRange(
      issues,
      'marketShockMagnitude',
      config.marketShockMagnitude,
      SIMULATION_LIMITS.marketShockMagnitude.min,
      SIMULATION_LIMITS.marketShockMagnitude.max,
    );
  }

  if (config.stockAllocation !== undefined) {
    validateFiniteRange(
      issues,
      'stockAllocation',
      config.stockAllocation,
      SIMULATION_LIMITS.stockAllocation.min,
      SIMULATION_LIMITS.stockAllocation.max,
    );
  }

  if (config.bondAnnualExpectedReturn !== undefined) {
    if (!Number.isFinite(config.bondAnnualExpectedReturn)) {
      addIssue(
        issues,
        'bondAnnualExpectedReturn',
        'not_finite',
        config.bondAnnualExpectedReturn,
        'bondAnnualExpectedReturn must be a finite number.',
      );
    } else {
      if (
        config.bondAnnualExpectedReturn <=
        SIMULATION_LIMITS.bondAnnualExpectedReturn.exclusiveMin
      ) {
        addIssue(
          issues,
          'bondAnnualExpectedReturn',
          'at_or_below_minimum',
          config.bondAnnualExpectedReturn,
          'bondAnnualExpectedReturn must be greater than -1.',
        );
      }

      if (
        config.bondAnnualExpectedReturn > SIMULATION_LIMITS.bondAnnualExpectedReturn.max
      ) {
        addIssue(
          issues,
          'bondAnnualExpectedReturn',
          'above_maximum',
          config.bondAnnualExpectedReturn,
          `bondAnnualExpectedReturn must be at most ${String(SIMULATION_LIMITS.bondAnnualExpectedReturn.max)}.`,
        );
      }
    }
  }

  if (config.bondAnnualVolatility !== undefined) {
    validateFiniteRange(
      issues,
      'bondAnnualVolatility',
      config.bondAnnualVolatility,
      SIMULATION_LIMITS.bondAnnualVolatility.min,
      SIMULATION_LIMITS.bondAnnualVolatility.max,
    );
  }

  if (config.stockBondCorrelation !== undefined) {
    validateFiniteRange(
      issues,
      'stockBondCorrelation',
      config.stockBondCorrelation,
      SIMULATION_LIMITS.stockBondCorrelation.min,
      SIMULATION_LIMITS.stockBondCorrelation.max,
    );
  }

  if (issues.length > 0) {
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }

  return Object.freeze({
    valid: true,
    value: Object.freeze({ ...config }),
    issues: NO_VALIDATION_ISSUES,
  });
}
