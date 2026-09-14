import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  validateSimulationJob,
  type SimulationConfigField,
  type SimulationJob,
} from '@marketsim/domain';

export interface AssumptionValues {
  annualInflation: string;
  annualReturn: string;
  horizonYears: string;
  initialCapital: string;
  monthlyContribution: string;
  simulationCount: string;
  volatility: string;
}

export const DEFAULT_SIMULATION_SEED = '6d2b79f5a4c3e21791f0bc8d457e306a' as const;

export const initialAssumptions: AssumptionValues = {
  annualInflation: '2.5',
  annualReturn: '6.5',
  horizonYears: '30',
  initialCapital: '10000',
  monthlyContribution: '450',
  simulationCount: '10000',
  volatility: '14',
};

export type AssumptionErrors = Partial<Record<keyof AssumptionValues, string>>;

export type BuildSimulationJobResult =
  | { readonly valid: true; readonly job: Readonly<SimulationJob> }
  | {
      readonly valid: false;
      readonly errors: Readonly<AssumptionErrors>;
      readonly message: string;
    };

const assumptionByConfigField: Readonly<
  Record<SimulationConfigField, keyof AssumptionValues>
> = {
  initialCapital: 'initialCapital',
  monthlyContribution: 'monthlyContribution',
  durationMonths: 'horizonYears',
  annualExpectedReturn: 'annualReturn',
  annualVolatility: 'volatility',
  annualInflation: 'annualInflation',
  simulationCount: 'simulationCount',
};

function numericValue(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

export function buildSimulationJob(
  assumptions: AssumptionValues,
): BuildSimulationJobResult {
  const job: SimulationJob = {
    schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    seed: DEFAULT_SIMULATION_SEED,
    config: {
      initialCapital: numericValue(assumptions.initialCapital),
      monthlyContribution: numericValue(assumptions.monthlyContribution),
      durationMonths: numericValue(assumptions.horizonYears) * 12,
      annualExpectedReturn: numericValue(assumptions.annualReturn) / 100,
      annualVolatility: numericValue(assumptions.volatility) / 100,
      annualInflation: numericValue(assumptions.annualInflation) / 100,
      simulationCount: numericValue(assumptions.simulationCount),
    },
  };
  const validation = validateSimulationJob(job);

  if (validation.valid) {
    return { valid: true, job: validation.value };
  }

  const errors: AssumptionErrors = {};
  for (const issue of validation.issues) {
    if (issue.field in assumptionByConfigField) {
      const configField = issue.field as SimulationConfigField;
      errors[assumptionByConfigField[configField]] = issue.message;
    }
  }

  return {
    valid: false,
    errors,
    message: 'Review the highlighted assumptions before running the simulation.',
  };
}
