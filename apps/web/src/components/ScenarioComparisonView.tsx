import { useState, type KeyboardEvent, type PointerEvent } from 'react';

import type { SimulationResult } from '@marketsim/domain';

import {
  formatCompactCurrency,
  formatCurrency,
  formatSimulationPeriod,
} from '../features/simulation/format';
import {
  COMPARISON_METRIC_KEYS,
  buildScenarioComparison,
  type ComparisonMetricKey,
  type ScenarioComparisonCheckpoint,
} from '../features/scenarios/scenario-comparison';
import {
  buildScenarioComparisonChartModel,
  type ScenarioChartSeries,
} from '../features/scenarios/scenario-comparison-chart-model';
import { messages } from '../i18n/en';
import {
  FAN_CHART_PLOT,
  FAN_CHART_VIEWBOX,
  areaPath,
  linePath,
  type ValueMode,
} from './fan-chart-model';

interface ScenarioComparisonViewProps {
  readonly mode: ValueMode;
  readonly scenarioA: SimulationResult;
  readonly scenarioB: SimulationResult;
}

const metricLabels: Readonly<Record<ComparisonMetricKey, string>> =
  messages.comparison.metric;

function exactCheckpoint(
  checkpoints: readonly Readonly<ScenarioComparisonCheckpoint>[],
  month: number,
): Readonly<ScenarioComparisonCheckpoint> {
  const checkpoint = checkpoints[month];
  if (!checkpoint || checkpoint.month !== month) {
    throw new RangeError(`Comparison checkpoint ${String(month)} is not available.`);
  }
  return checkpoint;
}

function formatDelta(value: number | undefined): string {
  if (value === undefined) {
    return messages.comparison.unavailable;
  }
  const formatted = formatCurrency(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatValue(value: number | undefined): string {
  return value === undefined ? messages.comparison.unavailable : formatCurrency(value);
}

interface ScenarioPanelProps {
  readonly finalMonth: number;
  readonly modeLabel: string;
  readonly model: ReturnType<typeof buildScenarioComparisonChartModel>;
  readonly onPointer: (event: PointerEvent<SVGSVGElement>) => void;
  readonly scenario: 'a' | 'b';
  readonly selected: Readonly<ScenarioComparisonCheckpoint>;
  readonly series: Readonly<ScenarioChartSeries>;
}

function ScenarioPanel({
  finalMonth,
  modeLabel,
  model,
  onPointer,
  scenario,
  selected,
  series,
}: ScenarioPanelProps) {
  const scenarioLabel =
    scenario === 'a' ? messages.comparison.scenarioA : messages.comparison.scenarioB;
  const scenarioValueKey = scenario === 'a' ? 'scenarioA' : 'scenarioB';
  const selectedMedian = selected.values.p50[scenarioValueKey];
  const titleId = `comparison-chart-${scenario}-title`;
  const descriptionId = `comparison-chart-${scenario}-description`;

  return (
    <section
      aria-labelledby={`comparison-panel-${scenario}-heading`}
      className={`comparison-panel comparison-panel--${scenario}`}
    >
      <header className="comparison-panel__header">
        <h5 id={`comparison-panel-${scenario}-heading`}>{scenarioLabel}</h5>
        <span>{messages.comparison.finalAt(formatSimulationPeriod(finalMonth))}</span>
      </header>
      <svg
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="fan-chart__svg comparison-panel__svg"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        role="img"
        viewBox={`0 0 ${String(FAN_CHART_VIEWBOX.width)} ${String(FAN_CHART_VIEWBOX.height)}`}
      >
        <title id={titleId}>
          {messages.comparison.panelAriaLabel(scenarioLabel, modeLabel)}
        </title>
        <desc id={descriptionId}>
          {messages.comparison.panelAriaDescription(
            scenarioLabel,
            modeLabel,
            finalMonth,
            model.xTicks.at(-1) ?? finalMonth,
          )}
        </desc>

        <g className="chart-grid" aria-hidden="true">
          {model.yTicks.map((value) => (
            <g key={value}>
              <line
                x1={FAN_CHART_PLOT.left}
                x2={FAN_CHART_PLOT.right}
                y1={model.yForValue(value)}
                y2={model.yForValue(value)}
              />
              <text x={FAN_CHART_PLOT.left - 11} y={model.yForValue(value) + 4}>
                {formatCompactCurrency(value)}
              </text>
            </g>
          ))}
          {model.xTicks.map((month) => (
            <g className="chart-grid__time" key={month}>
              <line
                x1={model.xForMonth(month)}
                x2={model.xForMonth(month)}
                y1={FAN_CHART_PLOT.top}
                y2={FAN_CHART_PLOT.bottom}
              />
              <text x={model.xForMonth(month)} y="296">
                {formatSimulationPeriod(month)}
              </text>
            </g>
          ))}
          <text className="chart-grid__axis-title" x={FAN_CHART_PLOT.right} y="316">
            {messages.chart.timeAxis}
          </text>
        </g>

        <g
          className={`comparison-series comparison-series--${scenario}`}
          aria-hidden="true"
        >
          <path
            className="comparison-range comparison-range--outer"
            d={areaPath(series.percentiles.p95, series.percentiles.p05)}
          />
          <path
            className="comparison-range comparison-range--middle"
            d={areaPath(series.percentiles.p90, series.percentiles.p10)}
          />
          <path
            className="comparison-range comparison-range--inner"
            d={areaPath(series.percentiles.p75, series.percentiles.p25)}
          />
          <path
            className="comparison-contributed"
            d={linePath(series.totalContributed)}
          />
          <path className="comparison-median" d={linePath(series.percentiles.p50)} />
        </g>

        {finalMonth < (model.xTicks.at(-1) ?? finalMonth) ? (
          <g className="comparison-horizon" aria-hidden="true">
            <line
              x1={model.xForMonth(finalMonth)}
              x2={model.xForMonth(finalMonth)}
              y1={FAN_CHART_PLOT.top}
              y2={FAN_CHART_PLOT.bottom}
            />
            <text x={model.xForMonth(finalMonth) - 6} y={FAN_CHART_PLOT.top + 11}>
              {messages.comparison.finalMarker}
            </text>
          </g>
        ) : null}

        <g className="chart-selection comparison-selection" aria-hidden="true">
          <line
            x1={model.xForMonth(selected.month)}
            x2={model.xForMonth(selected.month)}
            y1={FAN_CHART_PLOT.top}
            y2={FAN_CHART_PLOT.bottom}
          />
          {selectedMedian === undefined ? null : (
            <circle
              className={`comparison-selection__point comparison-selection__point--${scenario}`}
              cx={model.xForMonth(selected.month)}
              cy={model.yForValue(selectedMedian)}
              r="4"
            />
          )}
        </g>
      </svg>
    </section>
  );
}

export function ScenarioComparisonView({
  mode,
  scenarioA,
  scenarioB,
}: ScenarioComparisonViewProps) {
  const comparison = buildScenarioComparison(scenarioA, scenarioB, mode);
  const model = buildScenarioComparisonChartModel(comparison);
  const [selectedMonth, setSelectedMonth] = useState(comparison.commonFinalMonth);
  const selected = exactCheckpoint(comparison.checkpoints, selectedMonth);
  const scenarioAFinal = exactCheckpoint(
    comparison.checkpoints,
    comparison.scenarioAFinalMonth,
  );
  const scenarioBFinal = exactCheckpoint(
    comparison.checkpoints,
    comparison.scenarioBFinalMonth,
  );
  const commonFinal = exactCheckpoint(
    comparison.checkpoints,
    comparison.commonFinalMonth,
  );
  const modeLabel = messages.valueModes[mode];

  const inspectPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const viewBoxX =
      ((event.clientX - bounds.left) / bounds.width) * FAN_CHART_VIEWBOX.width;
    const plotRatio = Math.min(
      1,
      Math.max(
        0,
        (viewBoxX - FAN_CHART_PLOT.left) / (FAN_CHART_PLOT.right - FAN_CHART_PLOT.left),
      ),
    );
    setSelectedMonth(Math.round(plotRatio * comparison.finalMonth));
  };

  const inspectKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const nextMonth =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? comparison.finalMonth
          : event.key === 'PageUp'
            ? selected.month + 12
            : event.key === 'PageDown'
              ? selected.month - 12
              : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                ? selected.month + 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                  ? selected.month - 1
                  : undefined;

    if (nextMonth === undefined) {
      return;
    }
    event.preventDefault();
    setSelectedMonth(Math.min(comparison.finalMonth, Math.max(0, nextMonth)));
  };

  return (
    <figure className="fan-chart comparison-chart">
      <div
        aria-label={messages.comparison.chartLegendLabel}
        className="comparison-chart__legend"
      >
        <span>
          <i className="legend-swatch legend-swatch--outer" aria-hidden="true" />
          {messages.comparison.legendOuterRange}
        </span>
        <span>
          <i className="legend-swatch legend-swatch--middle" aria-hidden="true" />
          {messages.comparison.legendMiddleRange}
        </span>
        <span>
          <i className="legend-swatch legend-swatch--inner" aria-hidden="true" />
          {messages.comparison.legendInnerRange}
        </span>
        <span>
          <i className="comparison-line comparison-line--median" aria-hidden="true" />
          {messages.comparison.legendMedian}
        </span>
        <span>
          <i
            className="comparison-line comparison-line--contributed"
            aria-hidden="true"
          />
          {messages.comparison.legendContributed}
        </span>
      </div>

      <div className="comparison-small-multiples">
        <ScenarioPanel
          finalMonth={comparison.scenarioAFinalMonth}
          modeLabel={modeLabel}
          model={model}
          onPointer={inspectPointer}
          scenario="a"
          selected={selected}
          series={model.scenarioA}
        />
        <ScenarioPanel
          finalMonth={comparison.scenarioBFinalMonth}
          modeLabel={modeLabel}
          model={model}
          onPointer={inspectPointer}
          scenario="b"
          selected={selected}
          series={model.scenarioB}
        />
      </div>

      <div className="fan-chart__timeline">
        <label htmlFor="comparison-chart-period">
          {messages.comparison.inspectLabel}
        </label>
        <output htmlFor="comparison-chart-period">
          {formatSimulationPeriod(selected.month)}
        </output>
        <input
          aria-valuetext={formatSimulationPeriod(selected.month)}
          id="comparison-chart-period"
          max={comparison.finalMonth}
          min="0"
          onChange={(event) => setSelectedMonth(Number(event.target.value))}
          onKeyDown={inspectKey}
          step="1"
          type="range"
          value={selected.month}
        />
      </div>

      <section
        aria-atomic="true"
        aria-labelledby="comparison-inspector-title"
        aria-live="polite"
        className="comparison-inspector"
      >
        <header>
          <p>{messages.comparison.inspectorEyebrow}</p>
          <h4 id="comparison-inspector-title">
            {formatSimulationPeriod(selected.month)}
          </h4>
          <span>{messages.comparison.inspectorDescription(modeLabel)}</span>
        </header>
        <div className="comparison-table-scroll">
          <table>
            <caption className="visually-hidden">
              {messages.comparison.inspectorCaption(
                formatSimulationPeriod(selected.month),
                modeLabel,
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{messages.comparison.metricColumn}</th>
                <th scope="col">{messages.comparison.scenarioA}</th>
                <th scope="col">{messages.comparison.scenarioB}</th>
                <th scope="col">{messages.comparison.deltaColumn}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_METRIC_KEYS.map((key) => (
                <tr className={key === 'p50' ? 'is-median' : undefined} key={key}>
                  <th scope="row">{metricLabels[key]}</th>
                  <td>{formatValue(selected.values[key].scenarioA)}</td>
                  <td>{formatValue(selected.values[key].scenarioB)}</td>
                  <td>{formatDelta(selected.values[key].delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="comparison-finals-title" className="comparison-finals">
        <header>
          <p>{messages.comparison.finalsEyebrow}</p>
          <h4 id="comparison-finals-title">{messages.comparison.finalsTitle}</h4>
          <span>
            {messages.comparison.finalsDescription(
              formatSimulationPeriod(comparison.scenarioAFinalMonth),
              formatSimulationPeriod(comparison.scenarioBFinalMonth),
              formatSimulationPeriod(comparison.commonFinalMonth),
            )}
          </span>
        </header>
        <div className="comparison-table-scroll">
          <table>
            <caption className="visually-hidden">
              {messages.comparison.finalsCaption(modeLabel)}
            </caption>
            <thead>
              <tr>
                <th scope="col">{messages.comparison.metricColumn}</th>
                <th scope="col">
                  {messages.comparison.finalColumn(
                    messages.comparison.scenarioA,
                    formatSimulationPeriod(comparison.scenarioAFinalMonth),
                  )}
                </th>
                <th scope="col">
                  {messages.comparison.finalColumn(
                    messages.comparison.scenarioB,
                    formatSimulationPeriod(comparison.scenarioBFinalMonth),
                  )}
                </th>
                <th scope="col">
                  {messages.comparison.commonDeltaColumn(
                    formatSimulationPeriod(comparison.commonFinalMonth),
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_METRIC_KEYS.map((key) => (
                <tr className={key === 'p50' ? 'is-median' : undefined} key={key}>
                  <th scope="row">{metricLabels[key]}</th>
                  <td>{formatValue(scenarioAFinal.values[key].scenarioA)}</td>
                  <td>{formatValue(scenarioBFinal.values[key].scenarioB)}</td>
                  <td>{formatDelta(commonFinal.values[key].delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <figcaption>
        <span>{messages.comparison.note}</span>
        <span>{messages.comparison.deltaNote}</span>
      </figcaption>

      <details className="fan-chart__data comparison-data">
        <summary>{messages.comparison.tableSummary}</summary>
        <p>{messages.comparison.tableDescription}</p>
        <div className="fan-chart__table-scroll">
          <table>
            <caption>{messages.comparison.tableCaption(modeLabel)}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.chart.periodColumn}</th>
                <th scope="col">{messages.comparison.metricColumn}</th>
                <th scope="col">{messages.comparison.scenarioA}</th>
                <th scope="col">{messages.comparison.scenarioB}</th>
                <th scope="col">{messages.comparison.deltaColumn}</th>
              </tr>
            </thead>
            {model.checkpoints.map((checkpoint) => (
              <tbody key={checkpoint.month}>
                {COMPARISON_METRIC_KEYS.map((key, index) => (
                  <tr key={key}>
                    {index === 0 ? (
                      <th rowSpan={COMPARISON_METRIC_KEYS.length} scope="rowgroup">
                        {formatSimulationPeriod(checkpoint.month)}
                      </th>
                    ) : null}
                    <th scope="row">{metricLabels[key]}</th>
                    <td>{formatValue(checkpoint.values[key].scenarioA)}</td>
                    <td>{formatValue(checkpoint.values[key].scenarioB)}</td>
                    <td>{formatDelta(checkpoint.values[key].delta)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>
    </figure>
  );
}
