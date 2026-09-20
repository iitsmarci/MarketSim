import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { ActionButton, BrandMark, NumericField, ThemeSelector } from '@marketsim/ui';

import { FanChart } from './components/FanChart';
import { ScenarioComparisonView } from './components/ScenarioComparisonView';
import { SimulationResults } from './components/SimulationResults';
import type { ValueMode } from './components/fan-chart-model';
import {
  buildScenarioPair,
  initialScenarioComparisonSettings,
  scenarioAInitialAssumptions,
  scenarioBInitialAssumptions,
  type ScenarioAssumptionValues,
  type ScenarioComparisonSettings,
  type ScenarioId,
} from './features/scenarios/scenario-comparison';
import { formatDuration } from './features/simulation/format';
import {
  buildSimulationJob,
  type AssumptionErrors,
  type BuildSimulationJobResult,
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

type WorkspaceMode = 'single' | 'comparison';
type ComparisonPhase = 'idle' | 'running-a' | 'running-b' | 'success' | 'error';

interface AppProps {
  runner?: SimulationRunner;
}

interface ScenarioFieldsProps {
  readonly assumptions: ScenarioAssumptionValues;
  readonly disabled: boolean;
  readonly errors: AssumptionErrors;
  readonly idPrefix: string;
  readonly labelPrefix?: string;
  readonly onChange: (
    name: keyof ScenarioAssumptionValues,
  ) => (event: ChangeEvent<HTMLInputElement>) => void;
}

function ScenarioFields({
  assumptions,
  disabled,
  errors,
  idPrefix,
  labelPrefix = '',
  onChange,
}: ScenarioFieldsProps) {
  const label = (value: string) => `${labelPrefix}${value}`;

  return (
    <div className="assumption-fields scenario-fields">
      <NumericField
        disabled={disabled}
        error={errors.initialCapital}
        id={`${idPrefix}-initial-capital`}
        label={label(messages.assumptions.initialCapital)}
        min={0}
        onChange={onChange('initialCapital')}
        prefix={messages.units.currencySymbol}
        step={500}
        value={assumptions.initialCapital}
      />
      <NumericField
        disabled={disabled}
        error={errors.monthlyContribution}
        id={`${idPrefix}-monthly-contribution`}
        label={label(messages.assumptions.monthlyContribution)}
        min={0}
        onChange={onChange('monthlyContribution')}
        prefix={messages.units.currencySymbol}
        step={50}
        value={assumptions.monthlyContribution}
      />
      <NumericField
        disabled={disabled}
        error={errors.horizonYears}
        id={`${idPrefix}-horizon`}
        label={label(messages.assumptions.horizon)}
        max={100}
        min={1}
        onChange={onChange('horizonYears')}
        suffix={messages.units.years}
        step={1}
        value={assumptions.horizonYears}
      />
      <div className="assumption-row">
        <NumericField
          disabled={disabled}
          error={errors.annualReturn}
          id={`${idPrefix}-annual-return`}
          label={label(messages.assumptions.annualReturn)}
          max={1000}
          min={-99.9}
          onChange={onChange('annualReturn')}
          suffix={messages.units.percent}
          step={0.1}
          value={assumptions.annualReturn}
        />
        <NumericField
          disabled={disabled}
          description={messages.assumptions.inflationHelp}
          error={errors.annualInflation}
          id={`${idPrefix}-annual-inflation`}
          label={label(messages.assumptions.annualInflation)}
          max={100}
          min={-50}
          onChange={onChange('annualInflation')}
          suffix={messages.units.percent}
          step={0.1}
          value={assumptions.annualInflation}
        />
      </div>
      <NumericField
        description={messages.assumptions.volatilityHelp}
        disabled={disabled}
        error={errors.volatility}
        id={`${idPrefix}-volatility`}
        label={label(messages.assumptions.volatility)}
        max={500}
        min={0}
        onChange={onChange('volatility')}
        suffix={messages.units.percent}
        step={0.1}
        value={assumptions.volatility}
      />
    </div>
  );
}

function errorPayload(error: unknown): Readonly<{
  code: string;
  message: string;
}> {
  return error instanceof SimulationWorkerClientError
    ? error.payload
    : {
        code: 'unexpected_error',
        message: 'The simulation could not be completed. Try again.',
      };
}

export function App({ runner }: AppProps) {
  const [assumptions, setAssumptions] = useState(scenarioAInitialAssumptions);
  const [scenarioBAssumptions, setScenarioBAssumptions] = useState(
    scenarioBInitialAssumptions,
  );
  const [comparisonSettings, setComparisonSettings] =
    useState<ScenarioComparisonSettings>(initialScenarioComparisonSettings);
  const [assumptionErrors, setAssumptionErrors] = useState<AssumptionErrors>({});
  const [scenarioBErrors, setScenarioBErrors] = useState<AssumptionErrors>({});
  const [simulation, setSimulation] = useState<SimulationViewState>({ status: 'idle' });
  const [scenarioBSimulation, setScenarioBSimulation] = useState<SimulationViewState>({
    status: 'idle',
  });
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('single');
  const [comparisonPhase, setComparisonPhase] = useState<ComparisonPhase>('idle');
  const [valueMode, setValueMode] = useState<ValueMode>('nominal');
  const ownedRunner = useRef<SimulationWorkerClient | undefined>(undefined);
  const runToken = useRef(0);
  const { preference, setPreference } = useTheme();
  const isRunning =
    simulation.status === 'running' ||
    comparisonPhase === 'running-a' ||
    comparisonPhase === 'running-b';
  const singleResult =
    workspaceMode === 'single' && simulation.status === 'success'
      ? simulation.run.result
      : undefined;
  const comparisonReady =
    workspaceMode === 'comparison' &&
    comparisonPhase === 'success' &&
    simulation.status === 'success' &&
    scenarioBSimulation.status === 'success';

  useEffect(
    () => () => {
      ownedRunner.current?.terminate();
    },
    [],
  );

  const updateScenarioAssumption =
    (scenario: ScenarioId, name: keyof ScenarioAssumptionValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      runToken.current += 1;
      setComparisonPhase('idle');
      if (scenario === 'a') {
        setAssumptions((current) => ({ ...current, [name]: event.target.value }));
        setAssumptionErrors((current) => ({ ...current, [name]: undefined }));
        setSimulation({ status: 'idle' });
        if (workspaceMode === 'comparison') {
          setScenarioBSimulation({ status: 'idle' });
        }
      } else {
        setScenarioBAssumptions((current) => ({
          ...current,
          [name]: event.target.value,
        }));
        setScenarioBErrors((current) => ({ ...current, [name]: undefined }));
        setScenarioBSimulation({ status: 'idle' });
        if (workspaceMode === 'comparison') {
          setSimulation({ status: 'idle' });
        }
      }
    };

  const updateSimulationCount = (event: ChangeEvent<HTMLInputElement>) => {
    runToken.current += 1;
    setComparisonSettings((current) => ({
      ...current,
      simulationCount: event.target.value,
    }));
    setAssumptionErrors((current) => {
      const remaining = { ...current };
      delete remaining.simulationCount;
      return remaining;
    });
    setScenarioBErrors((current) => {
      const remaining = { ...current };
      delete remaining.simulationCount;
      return remaining;
    });
    setSimulation({ status: 'idle' });
    setScenarioBSimulation({ status: 'idle' });
    setComparisonPhase('idle');
  };

  const getRunner = (): SimulationRunner => {
    if (runner) {
      return runner;
    }

    ownedRunner.current ??= new SimulationWorkerClient();
    return ownedRunner.current;
  };

  const executeBuiltJob = async (
    built: BuildSimulationJobResult,
    token: number,
    setState: (state: SimulationViewState) => void,
  ) => {
    if (!built.valid) {
      return;
    }

    try {
      const completed = await getRunner().run(built.job);
      if (runToken.current === token) {
        setState({ status: 'success', run: completed });
      }
    } catch (error) {
      if (runToken.current === token) {
        setState({ status: 'error', ...errorPayload(error) });
      }
    }
  };

  const runSimulation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const built = buildSimulationJob(
      {
        ...assumptions,
        simulationCount: comparisonSettings.simulationCount,
      },
      comparisonSettings,
    );
    const token = runToken.current + 1;
    runToken.current = token;
    setWorkspaceMode('single');
    setComparisonPhase('idle');
    setScenarioBSimulation({ status: 'idle' });

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
    await executeBuiltJob(built, token, setSimulation);
    if (runToken.current === token) {
      setValueMode(built.job.config.annualInflation === 0 ? 'nominal' : 'real');
    }
  };

  const runComparison = async () => {
    const built = buildScenarioPair(
      assumptions,
      scenarioBAssumptions,
      comparisonSettings,
    );
    const token = runToken.current + 1;
    runToken.current = token;
    setWorkspaceMode('comparison');
    setAssumptionErrors(built.a.valid ? {} : built.a.errors);
    setScenarioBErrors(built.b.valid ? {} : built.b.errors);

    const inflationA = built.a.valid ? built.a.job.config.annualInflation : 0;
    const inflationB = built.b.valid ? built.b.job.config.annualInflation : 0;
    setValueMode(inflationA === 0 && inflationB === 0 ? 'nominal' : 'real');

    if (!built.a.valid || !built.b.valid) {
      setComparisonPhase('error');
      setSimulation(
        built.a.valid
          ? { status: 'idle' }
          : { status: 'error', code: 'validation_error', message: built.a.message },
      );
      setScenarioBSimulation(
        built.b.valid
          ? { status: 'idle' }
          : { status: 'error', code: 'validation_error', message: built.b.message },
      );
      return;
    }

    setSimulation({ status: 'running' });
    setScenarioBSimulation({ status: 'idle' });
    setComparisonPhase('running-a');

    let completedA: SimulationRunResult;
    try {
      completedA = await getRunner().run(built.a.job);
    } catch (error) {
      if (runToken.current === token) {
        setSimulation({ status: 'error', ...errorPayload(error) });
        setComparisonPhase('error');
      }
      return;
    }

    if (runToken.current !== token) {
      return;
    }

    setSimulation({ status: 'success', run: completedA });
    setScenarioBSimulation({ status: 'running' });
    setComparisonPhase('running-b');

    let completedB: SimulationRunResult;
    try {
      completedB = await getRunner().run(built.b.job);
    } catch (error) {
      if (runToken.current === token) {
        setScenarioBSimulation({ status: 'error', ...errorPayload(error) });
        setComparisonPhase('error');
      }
      return;
    }

    if (runToken.current === token) {
      setScenarioBSimulation({ status: 'success', run: completedB });
      setComparisonPhase('success');
    }
  };

  const activeStatus =
    workspaceMode === 'single'
      ? simulation.status
      : comparisonPhase === 'running-a' || comparisonPhase === 'running-b'
        ? 'running'
        : comparisonPhase === 'success' && comparisonReady
          ? 'success'
          : comparisonPhase === 'error'
            ? 'error'
            : 'idle';
  const workspaceStatus =
    workspaceMode === 'comparison'
      ? comparisonPhase === 'running-a'
        ? messages.comparison.statusRunningA
        : comparisonPhase === 'running-b'
          ? messages.comparison.statusRunningB
          : activeStatus === 'success'
            ? messages.comparison.statusSuccess
            : activeStatus === 'error'
              ? messages.comparison.statusError
              : messages.workspace.idle
      : activeStatus === 'idle'
        ? messages.workspace.idle
        : activeStatus === 'running'
          ? messages.workspace.running
          : activeStatus === 'success'
            ? messages.workspace.success
            : messages.workspace.error;
  const workspaceDescription =
    workspaceMode === 'comparison' && comparisonPhase === 'running-a'
      ? messages.comparison.statusDescriptionA
      : workspaceMode === 'comparison' && comparisonPhase === 'running-b'
        ? messages.comparison.statusDescriptionB
        : workspaceMode === 'comparison' && comparisonPhase === 'success'
          ? messages.comparison.statusDescriptionSuccess
          : simulation.status === 'success'
            ? `${simulation.run.result.config.simulationCount.toLocaleString('en-IE')} paths · ${formatDuration(simulation.run.metrics.totalDurationMs)} total · ${formatDuration(simulation.run.metrics.simulationDurationMs)} engine · ${formatDuration(simulation.run.metrics.boundaryDurationMs)} boundary`
            : simulation.status === 'running'
              ? messages.workspace.runningDescription
              : messages.workspace.idleDescription;
  const visualizationStatus =
    activeStatus === 'success' && workspaceMode === 'comparison'
      ? 'success'
      : activeStatus;

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
            <div className={`simulation-status simulation-status--${activeStatus}`}>
              <span>{workspaceStatus}</span>
              <p aria-live="polite">{workspaceDescription}</p>
              <code title="Reproducible simulation seed">
                {comparisonSettings.seed}
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
                <h3 id="assumptions-title">{messages.comparison.formTitle}</h3>
                <p>{messages.comparison.formDescription}</p>
              </div>

              <fieldset className="scenario-assumptions scenario-assumptions--a">
                <legend>{messages.comparison.scenarioA}</legend>
                <ScenarioFields
                  assumptions={assumptions}
                  disabled={isRunning}
                  errors={assumptionErrors}
                  idPrefix="scenario-a"
                  onChange={(name) => updateScenarioAssumption('a', name)}
                />
              </fieldset>

              <fieldset className="scenario-assumptions scenario-assumptions--b">
                <legend>{messages.comparison.scenarioB}</legend>
                <ScenarioFields
                  assumptions={scenarioBAssumptions}
                  disabled={isRunning}
                  errors={scenarioBErrors}
                  idPrefix="scenario-b"
                  labelPrefix={`${messages.comparison.scenarioB} · `}
                  onChange={(name) => updateScenarioAssumption('b', name)}
                />
              </fieldset>

              <fieldset className="scenario-assumptions shared-assumptions">
                <legend>{messages.comparison.shared}</legend>
                <div className="assumption-fields">
                  <NumericField
                    description={messages.assumptions.simulationCountHelp}
                    disabled={isRunning}
                    error={
                      assumptionErrors.simulationCount ??
                      scenarioBErrors.simulationCount
                    }
                    id="simulation-count"
                    label={messages.assumptions.simulationCount}
                    max={100000}
                    min={1}
                    onChange={updateSimulationCount}
                    suffix={messages.units.paths}
                    step={1000}
                    value={comparisonSettings.simulationCount}
                  />
                  <dl className="shared-reproducibility">
                    <div>
                      <dt>{messages.comparison.sharedSeed}</dt>
                      <dd>
                        <code>{comparisonSettings.seed}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>{messages.comparison.sharedModel}</dt>
                      <dd>
                        <code>{comparisonSettings.modelVersion}</code>
                      </dd>
                    </div>
                  </dl>
                </div>
              </fieldset>

              <div className="simulation-actions">
                <ActionButton
                  aria-busy={workspaceMode === 'single' && isRunning}
                  className="simulation-action"
                  disabled={isRunning}
                  type="submit"
                >
                  <span>
                    {workspaceMode === 'single' && isRunning
                      ? messages.assumptions.actionRunning
                      : messages.assumptions.action}
                  </span>
                  <span aria-hidden="true">
                    {workspaceMode === 'single' && isRunning ? '···' : '→'}
                  </span>
                </ActionButton>
                <ActionButton
                  aria-busy={workspaceMode === 'comparison' && isRunning}
                  className="simulation-action simulation-action--comparison"
                  disabled={isRunning}
                  onClick={() => void runComparison()}
                  type="button"
                >
                  <span>
                    {workspaceMode === 'comparison' && isRunning
                      ? messages.comparison.running
                      : messages.comparison.run}
                  </span>
                  <span aria-hidden="true">
                    {workspaceMode === 'comparison' && isRunning ? '···' : '↔'}
                  </span>
                </ActionButton>
              </div>
              <p className="action-note">{messages.comparison.actionNote}</p>
              {workspaceMode === 'single' && simulation.status === 'error' ? (
                <div className="simulation-error" role="alert">
                  <strong>Simulation error</strong>
                  <span>{simulation.message}</span>
                  <code>{simulation.code}</code>
                </div>
              ) : null}
              {workspaceMode === 'comparison' ? (
                <div className="comparison-errors">
                  {simulation.status === 'error' ? (
                    <div className="simulation-error" role="alert">
                      <strong>
                        {messages.comparison.errorTitle(messages.comparison.scenarioA)}
                      </strong>
                      <span>{simulation.message}</span>
                      <code>{simulation.code}</code>
                    </div>
                  ) : null}
                  {scenarioBSimulation.status === 'error' ? (
                    <div className="simulation-error" role="alert">
                      <strong>
                        {messages.comparison.errorTitle(messages.comparison.scenarioB)}
                      </strong>
                      <span>{scenarioBSimulation.message}</span>
                      <code>{scenarioBSimulation.code}</code>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </form>

            <section className="visualization" aria-labelledby="chart-section-title">
              <header className="visualization__header">
                <div>
                  <p className="eyebrow">
                    {workspaceMode === 'comparison'
                      ? messages.comparison.chartEyebrow
                      : messages.chart.eyebrow}
                  </p>
                  <h3 id="chart-section-title">
                    {workspaceMode === 'comparison'
                      ? messages.comparison.chartTitle
                      : messages.chart.title}
                  </h3>
                </div>
                <p>
                  {workspaceMode === 'comparison'
                    ? messages.comparison.chartDescription
                    : messages.chart.description}
                </p>
              </header>
              {singleResult || comparisonReady ? (
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
              {comparisonReady &&
              simulation.status === 'success' &&
              scenarioBSimulation.status === 'success' ? (
                <ScenarioComparisonView
                  key={`${simulation.run.result.seed}-${String(simulation.run.result.config.durationMonths)}-${String(scenarioBSimulation.run.result.config.durationMonths)}-${valueMode}`}
                  mode={valueMode}
                  scenarioA={simulation.run.result}
                  scenarioB={scenarioBSimulation.run.result}
                />
              ) : (
                <FanChart
                  mode={valueMode}
                  result={singleResult}
                  status={visualizationStatus}
                />
              )}
            </section>
          </div>

          {workspaceMode === 'single' ? (
            <SimulationResults mode={valueMode} result={singleResult} />
          ) : null}
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
