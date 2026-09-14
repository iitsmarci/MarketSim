import { useState, type KeyboardEvent, type PointerEvent } from 'react';

import {
  PERCENTILE_KEYS,
  type PercentileKey,
  type SimulationResult,
} from '@marketsim/domain';

import {
  formatCompactCurrency,
  formatCurrency,
  formatSimulationPeriod,
} from '../features/simulation/format';
import { messages } from '../i18n/en';
import {
  FAN_CHART_PLOT,
  FAN_CHART_VIEWBOX,
  areaPath,
  buildFanChartModel,
  linePath,
  nearestTrajectoryPoint,
  trajectoryForMode,
  type ValueMode,
} from './fan-chart-model';

interface FanChartProps {
  mode: ValueMode;
  result?: SimulationResult | undefined;
  status: 'idle' | 'running' | 'error' | 'success';
}

const percentileLabels: Readonly<Record<PercentileKey, string>> = Object.freeze({
  p05: 'P5',
  p10: 'P10',
  p25: 'P25',
  p50: 'P50',
  p75: 'P75',
  p90: 'P90',
  p95: 'P95',
});

function PopulatedFanChart({
  mode,
  result,
}: {
  readonly mode: ValueMode;
  readonly result: SimulationResult;
}) {
  const model = buildFanChartModel(result, mode);
  const trajectory = trajectoryForMode(result, mode);
  const [selectedMonth, setSelectedMonth] = useState(model.finalMonth);
  const selectedPoint = nearestTrajectoryPoint(trajectory, selectedMonth);
  const selectedX = model.xForMonth(selectedPoint.month);
  const finalStatistics =
    mode === 'real'
      ? result.realValues.finalValueStatistics
      : result.finalValueStatistics;
  const finalMedian = finalStatistics.percentiles.p50;
  const finalLow = finalStatistics.percentiles.p05;
  const finalHigh = finalStatistics.percentiles.p95;
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
    setSelectedMonth(Math.round(plotRatio * model.finalMonth));
  };

  const inspectKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const nextMonth =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? model.finalMonth
          : event.key === 'PageUp'
            ? selectedPoint.month + 12
            : event.key === 'PageDown'
              ? selectedPoint.month - 12
              : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                ? selectedPoint.month + 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                  ? selectedPoint.month - 1
                  : undefined;

    if (nextMonth === undefined) {
      return;
    }
    event.preventDefault();
    setSelectedMonth(Math.min(model.finalMonth, Math.max(0, nextMonth)));
  };

  return (
    <figure className="fan-chart">
      <div className="fan-chart__legend" aria-hidden="true">
        <span>
          <i className="legend-swatch legend-swatch--outer" />
          P5–P95
        </span>
        <span>
          <i className="legend-swatch legend-swatch--middle" />
          P10–P90
        </span>
        <span>
          <i className="legend-swatch legend-swatch--inner" />
          P25–P75
        </span>
        <span>
          <i className="legend-line legend-line--median" />
          P50
        </span>
        <span>
          <i className="legend-line legend-line--reference" />
          {messages.chart.contributions}
        </span>
      </div>

      <div className="fan-chart__plot">
        <svg
          aria-describedby="fan-chart-description"
          aria-labelledby="fan-chart-title"
          className="fan-chart__svg"
          onPointerDown={inspectPointer}
          onPointerMove={inspectPointer}
          role="img"
          viewBox={`0 0 ${String(FAN_CHART_VIEWBOX.width)} ${String(FAN_CHART_VIEWBOX.height)}`}
        >
          <title id="fan-chart-title">{messages.chart.ariaLabel(modeLabel)}</title>
          <desc id="fan-chart-description">
            {messages.chart.ariaDescription(
              modeLabel,
              model.finalMonth,
              formatCurrency(finalMedian),
              formatCurrency(finalLow),
              formatCurrency(finalHigh),
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

          <path
            className="chart-band chart-band--outer"
            d={areaPath(model.percentilePoints.p95, model.percentilePoints.p05)}
          />
          <path
            className="chart-band chart-band--middle"
            d={areaPath(model.percentilePoints.p90, model.percentilePoints.p10)}
          />
          <path
            className="chart-band chart-band--inner"
            d={areaPath(model.percentilePoints.p75, model.percentilePoints.p25)}
          />
          <path
            className="chart-reference"
            d={linePath(model.contributionPoints)}
            pathLength="1"
          />
          <path
            className="chart-median"
            d={linePath(model.percentilePoints.p50)}
            pathLength="1"
          />

          <g className="chart-selection" aria-hidden="true">
            <line
              x1={selectedX}
              x2={selectedX}
              y1={FAN_CHART_PLOT.top}
              y2={FAN_CHART_PLOT.bottom}
            />
            {PERCENTILE_KEYS.map((key) => (
              <circle
                className={`chart-selection__point chart-selection__point--${key}`}
                cx={selectedX}
                cy={model.yForValue(selectedPoint.percentiles[key])}
                key={key}
                r={key === 'p50' ? 4.5 : 2.5}
              />
            ))}
          </g>

          <circle
            className="chart-median__point"
            cx={model.xForMonth(model.finalMonth)}
            cy={model.yForValue(finalMedian)}
            r="4.5"
          />
          <text
            className="chart-direct-label"
            x={model.xForMonth(model.finalMonth) - 8}
            y={Math.max(FAN_CHART_PLOT.top + 10, model.yForValue(finalMedian) - 10)}
          >
            P50
          </text>
        </svg>
      </div>

      <div className="fan-chart__timeline">
        <label htmlFor="fan-chart-period">{messages.chart.inspectLabel}</label>
        <output htmlFor="fan-chart-period">
          {formatSimulationPeriod(selectedPoint.month)}
        </output>
        <input
          aria-valuetext={formatSimulationPeriod(selectedPoint.month)}
          id="fan-chart-period"
          max={model.finalMonth}
          min="0"
          onChange={(event) => setSelectedMonth(Number(event.target.value))}
          onKeyDown={inspectKey}
          step="1"
          type="range"
          value={selectedPoint.month}
        />
      </div>

      <section
        aria-atomic="true"
        aria-labelledby="fan-chart-inspector-title"
        aria-live="polite"
        className="fan-chart__inspector"
      >
        <header>
          <p>{messages.chart.inspectorEyebrow}</p>
          <h4 id="fan-chart-inspector-title">
            {formatSimulationPeriod(selectedPoint.month)}
          </h4>
          <span>{messages.chart.inspectorDescription(modeLabel)}</span>
        </header>
        <dl>
          {PERCENTILE_KEYS.map((key) => (
            <div className={key === 'p50' ? 'is-median' : undefined} key={key}>
              <dt>{percentileLabels[key]}</dt>
              <dd>{formatCurrency(selectedPoint.percentiles[key])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <figcaption>
        <span>{messages.chart.note(result.config.simulationCount)}</span>
        <span>
          {messages.chart.finalRange(
            modeLabel,
            formatCurrency(finalLow),
            formatCurrency(finalHigh),
          )}
        </span>
      </figcaption>

      <details className="fan-chart__data">
        <summary>{messages.chart.tableSummary}</summary>
        <p>{messages.chart.tableDescription}</p>
        <div className="fan-chart__table-scroll">
          <table>
            <caption>{messages.chart.tableCaption(modeLabel)}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.chart.periodColumn}</th>
                <th scope="col">{messages.chart.contributions}</th>
                {PERCENTILE_KEYS.map((key) => (
                  <th key={key} scope="col">
                    {percentileLabels[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.checkpoints.map((point) => (
                <tr key={point.month}>
                  <th scope="row">{formatSimulationPeriod(point.month)}</th>
                  <td>{formatCurrency(point.moneyContributed)}</td>
                  {PERCENTILE_KEYS.map((key) => (
                    <td key={key}>{formatCurrency(point.percentiles[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function FanChart({ mode, result, status }: FanChartProps) {
  if (!result) {
    return (
      <figure className="fan-chart fan-chart--empty">
        <div aria-live="polite" className="fan-chart__empty" role="status">
          <span>
            {status === 'running' ? messages.chart.running : messages.chart.empty}
          </span>
          <p>
            {status === 'running'
              ? messages.chart.runningDescription
              : messages.chart.emptyDescription}
          </p>
        </div>
      </figure>
    );
  }

  return (
    <PopulatedFanChart
      key={`${result.seed}-${String(result.config.durationMonths)}-${mode}`}
      mode={mode}
      result={result}
    />
  );
}
