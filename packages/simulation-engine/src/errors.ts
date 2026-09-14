import type { SimulationValidationIssue } from '@marketsim/domain';

export class SimulationValidationError extends Error {
  override readonly name = 'SimulationValidationError';
  readonly issues: readonly SimulationValidationIssue[];

  constructor(issues: readonly SimulationValidationIssue[]) {
    super(`Invalid simulation configuration (${String(issues.length)} issue(s)).`);
    this.issues = issues;
  }
}

export class InvalidRandomSampleError extends Error {
  override readonly name = 'InvalidRandomSampleError';
  readonly month: number;
  readonly pathIndex: number;
  readonly value: number;

  constructor(month: number, pathIndex: number, value: number) {
    super(
      `Random source returned a non-finite standard-normal value at month ${String(month)}, path ${String(pathIndex)}.`,
    );
    this.month = month;
    this.pathIndex = pathIndex;
    this.value = value;
  }
}

export class SimulationNumericalError extends Error {
  override readonly name = 'SimulationNumericalError';
  readonly month: number;
  readonly pathIndex: number;

  constructor(month: number, pathIndex: number) {
    super(
      `Simulation produced a non-finite balance at month ${String(month)}, path ${String(pathIndex)}.`,
    );
    this.month = month;
    this.pathIndex = pathIndex;
  }
}

export class SimulationDerivedValueError extends Error {
  override readonly name = 'SimulationDerivedValueError';
  readonly month: number;
  readonly quantity: string;

  constructor(month: number, quantity: string) {
    super(
      `Simulation produced a non-finite derived ${quantity} at month ${String(month)}.`,
    );
    this.month = month;
    this.quantity = quantity;
  }
}
