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
    annualInflation: 0.025,
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

function simulatedRun(job: SimulationJob): SimulationRunResult {
  return {
    ...fixtureRun,
    result: simulate(job),
  };
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
        annualInflation: 0.025,
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

  it("defaults non-zero inflation results to today's euros", async () => {
    render(<App runner={successfulRunner()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    const percentileList = await screen.findByLabelText(
      "Final value percentiles · Today's euros",
    );
    const primaryResults = screen.getByLabelText(
      "Key simulation results · Today's euros",
    );
    const final = fixtureRun.result.realValues.finalValueStatistics;
    await waitFor(() =>
      expect(
        within(primaryResults).getByText(formatCurrency(final.median)),
      ).toBeVisible(),
    );
    expect(
      within(primaryResults).getByText(
        formatCurrency(fixtureRun.result.realValues.contributions.totalContributions),
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
    expect(screen.getByRole('button', { name: 'Real' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches the chart, table, and result strip between real and nominal values', async () => {
    render(<App runner={successfulRunner()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    const nominalButton = await screen.findByRole('button', { name: 'Nominal' });
    fireEvent.click(nominalButton);

    expect(nominalButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /in Nominal euros/i })).toBeVisible();
    const results = screen.getByLabelText('Key simulation results · Nominal euros');
    expect(
      within(results).getByText(
        formatCurrency(fixtureRun.result.finalValueStatistics.median),
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Key simulated portfolio-value checkpoints and contributed capital in Nominal euros',
      ),
    ).toBeInTheDocument();
  });

  it('defaults a zero-inflation result to nominal while keeping real data equal', async () => {
    const zeroInflationJob: SimulationJob = {
      ...fixtureJob,
      config: { ...fixtureJob.config, annualInflation: 0 },
    };
    const zeroInflationRun: SimulationRunResult = {
      ...fixtureRun,
      result: simulate(zeroInflationJob),
    };
    const runner = new RecordingRunner(() => Promise.resolve(zeroInflationRun));
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Annual inflation assumption'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    const nominalButton = await screen.findByRole('button', { name: 'Nominal' });
    expect(nominalButton).toHaveAttribute('aria-pressed', 'true');
    expect(zeroInflationRun.result.realValues.finalValueStatistics).toEqual(
      zeroInflationRun.result.finalValueStatistics,
    );
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
    const selected = fixtureRun.result.realValues.trajectory[6];
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
    const primaryResults = await screen.findByLabelText(
      "Key simulation results · Today's euros",
    );
    await waitFor(() =>
      expect(
        within(primaryResults).getByText(
          formatCurrency(fixtureRun.result.realValues.finalValueStatistics.median),
        ),
      ).toBeVisible(),
    );

    fireEvent.change(screen.getByLabelText('Initial capital'), {
      target: { value: '20000' },
    });
    expect(
      within(primaryResults).queryByText(
        formatCurrency(fixtureRun.result.realValues.finalValueStatistics.median),
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));

    await waitFor(() =>
      expect(
        within(primaryResults).getByText(
          formatCurrency(secondRun.result.realValues.finalValueStatistics.median),
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

  it('accepts negative inflation and exposes inflation validation accessibly', async () => {
    const runner = successfulRunner();
    render(<App runner={runner} />);
    const input = screen.getByLabelText('Annual inflation assumption');

    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    await waitFor(() => expect(runner.jobs).toHaveLength(1));
    expect(runner.jobs[0]?.config.annualInflation).toBe(-0.05);

    fireEvent.change(input, { target: { value: '-50.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'highlighted assumptions',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the educational disclaimer and accessible theme selection', () => {
    render(<App runner={successfulRunner()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByText(/does not predict future market returns/i)).toBeVisible();
  });

  it('builds independent horizons and executes A then B with shared controls', async () => {
    let resolveScenarioA: ((run: SimulationRunResult) => void) | undefined;
    let call = 0;
    const runner = new RecordingRunner((job) => {
      call += 1;
      return call === 1
        ? new Promise((resolve) => {
            resolveScenarioA = resolve;
          })
        : Promise.resolve(simulatedRun(job));
    });
    render(<App runner={runner} />);

    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Initial capital'), {
      target: { value: '22000' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    await waitFor(() => expect(runner.jobs).toHaveLength(1));
    expect(screen.getByText('Running Scenario A')).toBeVisible();
    expect(runner.jobs[0]?.config.durationMonths).toBe(12);

    await act(async () => resolveScenarioA?.(simulatedRun(runner.jobs[0]!)));
    await waitFor(() => expect(runner.jobs).toHaveLength(2));
    expect(runner.jobs[1]?.config).toMatchObject({
      durationMonths: 24,
      initialCapital: 22_000,
      simulationCount: 32,
    });
    expect(runner.jobs[0]?.seed).toBe(runner.jobs[1]?.seed);
    expect(runner.jobs[0]?.modelVersion).toBe(runner.jobs[1]?.modelVersion);
    await screen.findByText('Comparison complete');
  });

  it('renders synchronized small multiples, all percentiles, unavailable values, and final results', async () => {
    const runner = new RecordingRunner((job) => Promise.resolve(simulatedRun(job)));
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    const charts = await screen.findAllByRole('img', {
      name: /fan chart of simulated portfolio values/i,
    });
    expect(charts).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Scenario A' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Scenario B' })).toBeVisible();

    const slider = screen.getByLabelText('Inspect comparison period');
    expect(slider).toHaveAttribute('max', '24');
    expect(slider).toHaveAttribute('aria-valuetext', '1 yr');
    const inspector = screen.getByRole('region', { name: '1 yr' });
    const inspectorTable = within(inspector).getByRole('table');
    for (const label of [
      'Total contributed',
      'P5 outcome',
      'P10 outcome',
      'P25 outcome',
      'P50 outcome',
      'P75 outcome',
      'P90 outcome',
      'P95 outcome',
    ]) {
      expect(within(inspectorTable).getByText(label)).toBeVisible();
    }

    fireEvent.change(slider, { target: { value: '18' } });
    expect(slider).toHaveAttribute('aria-valuetext', '1 yr 6 mo');
    const laterInspector = screen.getByRole('region', { name: '1 yr 6 mo' });
    expect(within(laterInspector).getAllByText('—').length).toBeGreaterThan(0);

    const finalResults = screen.getByRole('region', {
      name: 'Each endpoint, plus a like-for-like delta',
    });
    expect(finalResults).toHaveTextContent('Scenario A final · 1 yr');
    expect(finalResults).toHaveTextContent('Scenario B final · 2 yr');
    expect(finalResults).toHaveTextContent('Delta at common 1 yr');
    expect(screen.getByText(/not a quantile of the pathwise/i)).toBeVisible();
  });

  it('switches exact comparison metrics between real and nominal values', async () => {
    const runner = new RecordingRunner((job) => Promise.resolve(simulatedRun(job)));
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    const realInspector = await screen.findByRole('region', { name: '1 yr' });
    const realMedianRow = within(realInspector).getByText('P50 outcome').closest('tr');
    expect(realMedianRow).toHaveTextContent(
      formatCurrency(simulate(runner.jobs[0]!).realValues.finalValueStatistics.median),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nominal' }));
    const nominalMedianRow = within(screen.getByRole('region', { name: '1 yr' }))
      .getByText('P50 outcome')
      .closest('tr');
    expect(nominalMedianRow).toHaveTextContent(
      formatCurrency(simulate(runner.jobs[0]!).finalValueStatistics.median),
    );
    expect(
      screen.getByText(/comparison checkpoints in Nominal euros/i),
    ).toBeInTheDocument();
  });

  it('defaults a zero-inflation comparison to nominal', async () => {
    const runner = new RecordingRunner((job) => Promise.resolve(simulatedRun(job)));
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Annual inflation assumption'), {
      target: { value: '0' },
    });
    fireEvent.change(
      screen.getByLabelText('Scenario B · Annual inflation assumption'),
      { target: { value: '0' } },
    );
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    const nominalButton = await screen.findByRole('button', { name: 'Nominal' });
    await waitFor(() => expect(nominalButton).toHaveAttribute('aria-pressed', 'true'));
  });

  it('validates both scenarios before dispatching either job', async () => {
    const runner = successfulRunner();
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Initial capital'), {
      target: { value: '-1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Annual return assumption'), {
      target: { value: 'not-a-number' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent('Scenario A error');
    expect(alerts[1]).toHaveTextContent('Scenario B error');
    expect(runner.jobs).toHaveLength(0);
  });

  it('stops before Scenario B when Scenario A execution fails', async () => {
    const runner = new RecordingRunner(() =>
      Promise.reject(
        new SimulationWorkerClientError({
          code: 'numerical_error',
          message: 'Scenario A exceeded the supported numeric range.',
          technical: {},
        }),
      ),
    );
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Scenario A error');
    expect(screen.getByText('Comparison needs attention')).toBeVisible();
    expect(runner.jobs).toHaveLength(1);
  });

  it('attributes a Scenario B execution failure after Scenario A succeeds', async () => {
    let call = 0;
    const runner = new RecordingRunner((job) => {
      call += 1;
      return call === 1
        ? Promise.resolve(simulatedRun(job))
        : Promise.reject(
            new SimulationWorkerClientError({
              code: 'numerical_error',
              message: 'Scenario B exceeded the supported numeric range.',
              technical: {},
            }),
          );
    });
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Scenario B error');
    expect(runner.jobs).toHaveLength(2);
  });

  it('clears a stale comparison as soon as either scenario changes', async () => {
    const runner = new RecordingRunner((job) => Promise.resolve(simulatedRun(job)));
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));
    await screen.findAllByRole('img', { name: /fan chart/i });

    fireEvent.change(screen.getByLabelText('Scenario B · Monthly contribution'), {
      target: { value: '800' },
    });
    expect(screen.queryByRole('img', { name: /Scenario A fan chart/i })).toBeNull();
    expect(screen.getByText('No simulated result yet')).toBeVisible();
  });

  it('disables both scenario controls during each sequential run', async () => {
    const resolvers: Array<(run: SimulationRunResult) => void> = [];
    const runner = new RecordingRunner(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    render(<App runner={runner} />);
    fireEvent.change(screen.getByLabelText('Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Scenario B · Time horizon'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Simulated paths'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }));

    expect(screen.getByRole('button', { name: 'Running comparison…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Run simulation' })).toBeDisabled();
    expect(screen.getByLabelText('Initial capital')).toBeDisabled();
    expect(screen.getByLabelText('Scenario B · Initial capital')).toBeDisabled();
    expect(runner.jobs).toHaveLength(1);

    resolvers[0]?.(simulatedRun(runner.jobs[0]!));
    await waitFor(() => expect(runner.jobs).toHaveLength(2));
    expect(screen.getByText('Running Scenario B')).toBeVisible();
    resolvers[1]?.(simulatedRun(runner.jobs[1]!));
    await screen.findByText('Comparison complete');
  });
});
