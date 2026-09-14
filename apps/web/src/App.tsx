import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { ActionButton, BrandMark, NumericField, ThemeSelector } from '@marketsim/ui';

import { FanChart } from './components/FanChart';
import { SimulationResults } from './components/SimulationResults';
import type { ValueMode } from './components/fan-chart-model';
import { formatDuration } from './features/simulation/format';
import {
  buildSimulationJob,
  DEFAULT_SIMULATION_SEED,
  initialAssumptions,
  type AssumptionErrors,
  type AssumptionValues,
} from './features/simulation/simulation-job';
import { messages } from './i18n/en';
import { useTheme } from './theme/useTheme';
import {
  SimulationWorkerClient,
  SimulationWorkerClientError,
  type SimulationRunner,
} from './workers/simulation-worker-client';
import type { SimulationRunResult } from './workers/simulation-worker-protocol';

type SimulationViewState =
  | { readonly status: 'idle' }
  | { readonly status: 'running' }
  | { readonly status: 'success'; readonly run: SimulationRunResult }
  | {
      readonly status: 'error';
      readonly code: string;
      readonly message: string;
    };

interface AppProps {
  runner?: SimulationRunner;
}

export function App({ runner }: AppProps) {
  const [assumptions, setAssumptions] = useState(initialAssumptions);
  const [assumptionErrors, setAssumptionErrors] = useState<AssumptionErrors>({});
  const [simulation, setSimulation] = useState<SimulationViewState>({ status: 'idle' });
  const [valueMode, setValueMode] = useState<ValueMode>('nominal');
  const ownedRunner = useRef<SimulationWorkerClient | undefined>(undefined);
  const { preference, setPreference } = useTheme();
  const isRunning = simulation.status === 'running';
  const result = simulation.status === 'success' ? simulation.run.result : undefined;

  useEffect(
    () => () => {
      ownedRunner.current?.terminate();
    },
    [],
  );

  const updateAssumption =
    (name: keyof AssumptionValues) => (event: ChangeEvent<HTMLInputElement>) => {
      setAssumptions((current) => ({ ...current, [name]: event.target.value }));
      setAssumptionErrors((current) => ({ ...current, [name]: undefined }));
      setSimulation({ status: 'idle' });
    };

  const getRunner = (): SimulationRunner => {
    if (runner) {
      return runner;
    }

    ownedRunner.current ??= new SimulationWorkerClient();
    return ownedRunner.current;
  };

  const runSimulation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const built = buildSimulationJob(assumptions);

    if (!built.valid) {
      setAssumptionErrors(built.errors);
      setSimulation({
        status: 'error',
        code: 'validation_error',
        message: built.message,
      });
      return;
    }

    setAssumptionErrors({});
    setSimulation({ status: 'running' });

    try {
      const completed = await getRunner().run(built.job);
      setValueMode(completed.result.config.annualInflation === 0 ? 'nominal' : 'real');
      setSimulation({ status: 'success', run: completed });
    } catch (error) {
      const payload =
        error instanceof SimulationWorkerClientError
          ? error.payload
          : {
              code: 'unexpected_error',
              message: 'The simulation could not be completed. Try again.',
            };
      setSimulation({
        status: 'error',
        code: payload.code,
        message: payload.message,
      });
    }
  };

  const workspaceStatus =
    simulation.status === 'idle'
      ? messages.workspace.idle
      : simulation.status === 'running'
        ? messages.workspace.running
        : simulation.status === 'success'
          ? messages.workspace.success
          : messages.workspace.error;
  const workspaceDescription =
    simulation.status === 'success'
      ? `${result?.config.simulationCount.toLocaleString('en-IE')} paths · ${formatDuration(simulation.run.metrics.totalDurationMs)} total · ${formatDuration(simulation.run.metrics.simulationDurationMs)} engine · ${formatDuration(simulation.run.metrics.boundaryDurationMs)} boundary`
      : simulation.status === 'running'
        ? messages.workspace.runningDescription
        : messages.workspace.idleDescription;

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand-link" href="#top" aria-label={messages.nav.homeLabel}>
          <BrandMark />
        </a>
        <nav aria-label={messages.nav.primaryLabel} className="primary-nav">
          <a aria-current="page" href="#workspace">
            {messages.nav.workspace}
          </a>
          <a href="#method">{messages.nav.method}</a>
        </nav>
        <div className="header-tools">
          <span className="local-status">
            <i aria-hidden="true" />
            {messages.nav.localOnly}
          </span>
          <ThemeSelector onChange={setPreference} value={preference} />
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">{messages.hero.eyebrow}</p>
            <h1 id="hero-title">{messages.hero.title}</h1>
            <p className="hero__description">{messages.hero.description}</p>
          </div>
          <aside className="hero__principle">
            <span>{messages.hero.principleLabel}</span>
            <p>{messages.hero.principle}</p>
          </aside>
        </section>

        <section className="workspace" id="workspace" aria-labelledby="workspace-title">
          <header className="workspace__header">
            <div>
              <p className="eyebrow">{messages.workspace.eyebrow}</p>
              <h2 id="workspace-title">{messages.workspace.title}</h2>
            </div>
            <div
              className={`simulation-status simulation-status--${simulation.status}`}
            >
              <span>{workspaceStatus}</span>
              <p aria-live="polite">{workspaceDescription}</p>
              <code title="Reproducible simulation seed">
                {DEFAULT_SIMULATION_SEED}
              </code>
            </div>
          </header>

          <div className="workspace__body">
            <form
              aria-labelledby="assumptions-title"
              className="assumptions"
              noValidate
              onSubmit={(event) => void runSimulation(event)}
            >
              <div className="section-heading">
                <p className="eyebrow">{messages.assumptions.eyebrow}</p>
                <h3 id="assumptions-title">{messages.assumptions.title}</h3>
                <p>{messages.assumptions.description}</p>
              </div>

              <div className="assumption-fields">
                <NumericField
                  disabled={isRunning}
                  error={assumptionErrors.initialCapital}
                  id="initial-capital"
                  label={messages.assumptions.initialCapital}
                  min={0}
                  onChange={updateAssumption('initialCapital')}
                  prefix={messages.units.currencySymbol}
                  step={500}
                  value={assumptions.initialCapital}
                />
                <NumericField
                  disabled={isRunning}
                  error={assumptionErrors.monthlyContribution}
                  id="monthly-contribution"
                  label={messages.assumptions.monthlyContribution}
                  min={0}
                  onChange={updateAssumption('monthlyContribution')}
                  prefix={messages.units.currencySymbol}
                  step={50}
                  value={assumptions.monthlyContribution}
                />
                <NumericField
                  disabled={isRunning}
                  error={assumptionErrors.horizonYears}
                  id="horizon"
                  label={messages.assumptions.horizon}
                  max={100}
                  min={1}
                  onChange={updateAssumption('horizonYears')}
                  suffix={messages.units.years}
                  step={1}
                  value={assumptions.horizonYears}
                />
                <div className="assumption-row">
                  <NumericField
                    disabled={isRunning}
                    error={assumptionErrors.annualReturn}
                    id="annual-return"
                    label={messages.assumptions.annualReturn}
                    max={1000}
                    min={-99.9}
                    onChange={updateAssumption('annualReturn')}
                    suffix={messages.units.percent}
                    step={0.1}
                    value={assumptions.annualReturn}
                  />
                  <NumericField
                    disabled={isRunning}
                    description={messages.assumptions.inflationHelp}
                    error={assumptionErrors.annualInflation}
                    id="annual-inflation"
                    label={messages.assumptions.annualInflation}
                    max={100}
                    min={-50}
                    onChange={updateAssumption('annualInflation')}
                    suffix={messages.units.percent}
                    step={0.1}
                    value={assumptions.annualInflation}
                  />
                </div>
                <NumericField
                  description={messages.assumptions.volatilityHelp}
                  disabled={isRunning}
                  error={assumptionErrors.volatility}
                  id="volatility"
                  label={messages.assumptions.volatility}
                  max={500}
                  min={0}
                  onChange={updateAssumption('volatility')}
                  suffix={messages.units.percent}
                  step={0.1}
                  value={assumptions.volatility}
                />
                <NumericField
                  description={messages.assumptions.simulationCountHelp}
                  disabled={isRunning}
                  error={assumptionErrors.simulationCount}
                  id="simulation-count"
                  label={messages.assumptions.simulationCount}
                  max={100000}
                  min={1}
                  onChange={updateAssumption('simulationCount')}
                  suffix={messages.units.paths}
                  step={1000}
                  value={assumptions.simulationCount}
                />
              </div>

              <ActionButton
                aria-busy={isRunning}
                className="simulation-action"
                disabled={isRunning}
                type="submit"
              >
                <span>
                  {isRunning
                    ? messages.assumptions.actionRunning
                    : messages.assumptions.action}
                </span>
                <span aria-hidden="true">{isRunning ? '···' : '→'}</span>
              </ActionButton>
              <p className="action-note">{messages.assumptions.actionNote}</p>
              {simulation.status === 'error' ? (
                <div className="simulation-error" role="alert">
                  <strong>Simulation error</strong>
                  <span>{simulation.message}</span>
                  <code>{simulation.code}</code>
                </div>
              ) : null}
            </form>

            <section className="visualization" aria-labelledby="chart-section-title">
              <header className="visualization__header">
                <div>
                  <p className="eyebrow">{messages.chart.eyebrow}</p>
                  <h3 id="chart-section-title">{messages.chart.title}</h3>
                </div>
                <p>{messages.chart.description}</p>
              </header>
              {result ? (
                <div className="value-mode-panel">
                  <div
                    aria-label={messages.chart.valueModeLabel}
                    className="value-mode"
                    role="group"
                  >
                    <button
                      aria-pressed={valueMode === 'nominal'}
                      onClick={() => setValueMode('nominal')}
                      type="button"
                    >
                      {messages.chart.nominalMode}
                    </button>
                    <button
                      aria-pressed={valueMode === 'real'}
                      onClick={() => setValueMode('real')}
                      type="button"
                    >
                      {messages.chart.realMode}
                    </button>
                  </div>
                  <p>{messages.chart.realAssumption}</p>
                </div>
              ) : null}
              <FanChart mode={valueMode} result={result} status={simulation.status} />
            </section>
          </div>

          <SimulationResults mode={valueMode} result={result} />
        </section>

        <section className="method" id="method" aria-labelledby="method-title">
          <div>
            <p className="eyebrow">{messages.method.eyebrow}</p>
            <h2 id="method-title">{messages.method.title}</h2>
          </div>
          <div>
            <p className="method__description">{messages.method.description}</p>
            <p className="disclaimer">{messages.method.disclaimer}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
