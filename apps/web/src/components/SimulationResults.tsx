import type { SimulationResult } from '@marketsim/domain';

import { formatCurrency } from '../features/simulation/format';
import { messages } from '../i18n/en';

interface SimulationResultsProps {
  result?: SimulationResult | undefined;
}

export function SimulationResults({ result }: SimulationResultsProps) {
  const finalStatistics = result?.finalValueStatistics;
  const growthStatistics = result?.investmentGrowthStatistics;
  const primaryResults = [
    [messages.results.finalValue, finalStatistics?.median],
    [messages.results.contributed, result?.contributions.totalContributions],
    [messages.results.growth, growthStatistics?.median],
  ] as const;
  const percentiles = [
    ['P5', finalStatistics?.percentiles.p05],
    ['P10', finalStatistics?.percentiles.p10],
    ['P25', finalStatistics?.percentiles.p25],
    ['P50', finalStatistics?.percentiles.p50],
    ['P75', finalStatistics?.percentiles.p75],
    ['P90', finalStatistics?.percentiles.p90],
    ['P95', finalStatistics?.percentiles.p95],
  ] as const;

  return (
    <section aria-labelledby="results-title" className="results-region">
      <header className="results-region__header">
        <p className="eyebrow">03 · Results</p>
        <h3 id="results-title">{messages.results.title}</h3>
      </header>
      <dl aria-label={messages.results.label} className="results-strip">
        {primaryResults.map(([label, value]) => (
          <div className="result" key={label}>
            <dt>{label}</dt>
            <dd>{value === undefined ? '—' : formatCurrency(value)}</dd>
            <span>
              {result ? messages.results.simulated : messages.results.awaiting}
            </span>
          </div>
        ))}
      </dl>
      <dl aria-label={messages.results.percentileLabel} className="percentile-strip">
        {percentiles.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === undefined ? '—' : formatCurrency(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
