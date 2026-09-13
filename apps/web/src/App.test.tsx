import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  MONTHLY_LOGNORMAL_MODEL_VERSION,
  SIMULATION_JOB_SCHEMA_VERSION,
  type SimulationJob,
} from '@marketsim/domain';
import { simulate } from '@marketsim/simulation-engine';

import { App } from './App';
import { formatCurrency } from './features/simulation/format';
import {
  SimulationWorkerClientError,
  type SimulationRunner,
} from './workers/simulation-worker-client';
import type { SimulationRunResult } from './workers/simulation-worker-protocol';

const fixtureJob: SimulationJob = {
  schemaVersion: SIMULATION_JOB_SCHEMA_VERSION,
  modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
  seed: '6d2b79f5a4c3e21791f0bc8d457e306a',
  config: {
    initialCapital: 10_000,
    monthlyContribution: 450,
    durationMonths: 12,
    annualExpectedReturn: 0.065,
    annualVolatility: 0.14,
    simulationCount: 32,
  },
};

const fixtureRun: SimulationRunResult = {
  result: simulate(fixtureJob),
  metrics: {
    validationDurationMs: 0.2,
    simulationDurationMs: 12,
    workerStartupDurationMs: 2,
    requestDurationMs: 1,
    responseDurationMs: 2,
    boundaryDurationMs: 3,
    totalDurationMs: 15,
  },
};

class RecordingRunner implements SimulationRunner {
  readonly jobs: SimulationJob[] = [];
  readonly #run: (job: SimulationJob) => Promise<SimulationRunResult>;

  constructor(run: (job: SimulationJob) => Promise<SimulationRunResult>) {
    this.#run = run;
  }

  run(job: SimulationJob): Promise<SimulationRunResult> {
    this.jobs.push(job);
    return this.#run(job);
  }
}

function successfulRunner(): RecordingRunner {
  return new RecordingRunner(() => Promise.resolve(fixtureRun));
}

describe('MarketSim simulation workspace', () => {
  it('builds the correct job and calls the simulation runner on submit', async () => {
    const runner = successfulRunner();
    render(<App runner={runner} />);

    fireEvent.change(screen.getByLabelText('Initial capital'), {
      target: { value: '12500' },
    });
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '15' },
    });
    fireEvent.change(screen.getByLabelText('Annual return assumption'), {
      target: { value: '7.25' },
    });
    fireEvent.change(screen.getByLabelText('Annual volatility'), {
      target: { value: '18.5' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '50000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    await waitFor(() => expect(runner.jobs).toHaveLength(1));
    expect(runner.jobs[0]).toMatchObject({
      config: {
        initialCapital: 12_500,
        durationMonths: 180,
        annualExpectedReturn: 0.0725,
        annualVolatility: 0.185,
        simulationCount: 50_000,
      },
    });
  });

  it('announces running state and disables mutable controls', async () => {
    let resolveRun: ((run: SimulationRunResult) => void) | undefined;
    const runner = new RecordingRunner(
      () =>
        new Promise((resolve) => {
          resolveRun = resolve;
        }),
    );
    render(<App runner={runner} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    expect(screen.getByRole('button', { name: 'Running simulation…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Running simulation…' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByLabelText('Initial capital')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Calculating percentile bands',
    );

    await act(async () => resolveRun?.(fixtureRun));
  });

  it('renders real result values and every requested percentile', async () => {
    render(<App runner={successfulRunner()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    const percentileList = await screen.findByLabelText('Final value percentiles');
    const primaryResults = screen.getByLabelText('Key simulation results');
    const final = fixtureRun.result.finalValueStatistics;
    await waitFor(() =>
      expect(
        within(primaryResults).getByText(formatCurrency(final.median)),
      ).toBeVisible(),
    );
    expect(
      within(primaryResults).getByText(
        formatCurrency(fixtureRun.result.contributions.totalContributions),
      ),
    ).toBeVisible();
    for (const [label, value] of [
      ['P5', final.percentiles.p05],
      ['P10', final.percentiles.p10],
      ['P25', final.percentiles.p25],
      ['P50', final.percentiles.p50],
      ['P75', final.percentiles.p75],
      ['P90', final.percentiles.p90],
      ['P95', final.percentiles.p95],
    ] as const) {
      const item = within(percentileList).getByText(label).parentElement;
      expect(item).toHaveTextContent(formatCurrency(value));
    }
    expect(screen.getByRole('img', { name: /fan chart of simulated/i })).toBeVisible();
  });

  it('offers keyboard-equivalent period inspection with all seven values', async () => {
    render(<App runner={successfulRunner()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    const slider = await screen.findByLabelText('Inspect simulation period');
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '12');
    expect(slider).toHaveAttribute('aria-valuetext', '1 yr');

    fireEvent.change(slider, { target: { value: '6' } });
    expect(slider).toHaveAttribute('aria-valuetext', '6 mo');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuetext', '5 mo');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuetext', '6 mo');
    const selected = fixtureRun.result.trajectory[6];
    expect(selected).toBeDefined();
    if (!selected) {
      return;
    }

    const inspector = screen.getByRole('region', { name: '6 mo' });
    for (const [label, key] of [
      ['P5', 'p05'],
      ['P10', 'p10'],
      ['P25', 'p25'],
      ['P50', 'p50'],
      ['P75', 'p75'],
      ['P90', 'p90'],
      ['P95', 'p95'],
    ] as const) {
      expect(within(inspector).getByText(label).parentElement).toHaveTextContent(
        formatCurrency(selected.percentiles[key]),
      );
    }
  });

  it('updates the inspector from mouse or touch-compatible pointer input', async () => {
    render(<App runner={successfulRunner()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    const chart = await screen.findByRole('img', {
      name: /fan chart of simulated/i,
    });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 320,
        height: 320,
        left: 0,
        right: 780,
        top: 0,
        width: 780,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });

    fireEvent.pointerDown(chart, { clientX: 68, pointerType: 'touch' });
    expect(screen.getByLabelText('Inspect simulation period')).toHaveAttribute(
      'aria-valuetext',
      'Start',
    );
    fireEvent.pointerMove(chart, { clientX: 408, pointerType: 'mouse' });
    expect(screen.getByLabelText('Inspect simulation period')).toHaveAttribute(
      'aria-valuetext',
      '6 mo',
    );
  });

  it('surfaces a structured Worker error as an accessible alert', async () => {
    const runner = new RecordingRunner(() =>
      Promise.reject(
        new SimulationWorkerClientError({
          code: 'numerical_error',
          message: 'The selected assumptions exceeded the supported numeric range.',
          technical: { month: 4, pathIndex: 12 },
        }),
      ),
    );
    render(<App runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('numeric range');
    expect(alert).toHaveTextContent('numerical_error');
    expect(alert).not.toHaveTextContent('pathIndex');
  });

  it('clears stale output after edits and displays a new simulation result', async () => {
    const secondJob: SimulationJob = {
      ...fixtureJob,
      config: { ...fixtureJob.config, initialCapital: 20_000 },
    };
    const secondRun: SimulationRunResult = {
      ...fixtureRun,
      result: simulate(secondJob),
    };
    const queuedRuns = [fixtureRun, secondRun];
    const runner = new RecordingRunner(() =>
      Promise.resolve(queuedRuns.shift() ?? secondRun),
    );
    render(<App runner={runner} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    const primaryResults = await screen.findByLabelText('Key simulation results');
    await waitFor(() =>
      expect(
        within(primaryResults).getByText(
          formatCurrency(fixtureRun.result.finalValueStatistics.median),
        ),
      ).toBeVisible(),
    );

    fireEvent.change(screen.getByLabelText('Initial capital'), {
      target: { value: '20000' },
    });
    expect(
      within(primaryResults).queryByText(
        formatCurrency(fixtureRun.result.finalValueStatistics.median),
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    await waitFor(() =>
      expect(
        within(primaryResults).getByText(
          formatCurrency(secondRun.result.finalValueStatistics.median),
        ),
      ).toBeVisible(),
    );
    expect(runner.jobs).toHaveLength(2);
  });

  it('blocks invalid assumptions and associates errors with their inputs', async () => {
    const runner = successfulRunner();
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'highlighted assumptions',
    );
    expect(screen.getByLabelText('Time horizon')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(runner.jobs).toHaveLength(0);
  });

  it('keeps the educational disclaimer and accessible theme selection', () => {
    render(<App runner={successfulRunner()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByText(/does not predict future market returns/i)).toBeVisible();
  });
});
