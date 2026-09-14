export const messages = {
  valueModes: {
    nominal: 'Nominal euros',
    real: "Today's euros",
  },
  nav: {
    homeLabel: 'MarketSim home',
    primaryLabel: 'Primary navigation',
    workspace: 'Workspace',
    method: 'Model notes',
    localOnly: 'Local only',
  },
  hero: {
    eyebrow: 'Monte Carlo learning lab',
    title: 'See the range, not a promise.',
    description:
      'Explore how return, volatility, time, and contributions shape a distribution of possible outcomes.',
    principleLabel: 'Design principle',
    principle:
      'The range is the result. A median is context—not a prediction of what will happen.',
  },
  workspace: {
    eyebrow: 'Simulation workspace',
    title: 'Long-term investment horizon',
    idle: 'Ready',
    running: 'Calculating',
    success: 'Simulation complete',
    error: 'Needs attention',
    idleDescription: 'Set the assumptions, then run the seeded model.',
    runningDescription: 'The calculation is running away from the interface thread.',
  },
  assumptions: {
    eyebrow: '01 · Assumptions',
    title: 'Set the conditions',
    description: 'Annual assumptions are converted to monthly steps by the model.',
    initialCapital: 'Initial capital',
    monthlyContribution: 'Monthly contribution',
    horizon: 'Time horizon',
    annualReturn: 'Annual return assumption',
    annualInflation: 'Annual inflation assumption',
    volatility: 'Annual volatility',
    simulationCount: 'Simulated paths',
    volatilityHelp:
      'Volatility describes how widely returns vary. It does not imply higher returns.',
    inflationHelp:
      "A fixed price-level assumption used to express results in today's purchasing power. It is not simulated risk.",
    simulationCountHelp:
      'More paths improve sample stability but take longer to calculate.',
    action: 'Run simulation',
    actionRunning: 'Running simulation…',
    actionNote:
      'Uses an explicit fixed seed so the same assumptions reproduce exactly.',
  },
  chart: {
    eyebrow: '02 · Uncertainty',
    title: 'Possible portfolio paths',
    description: 'A wider fan means a wider range of simulated outcomes.',
    empty: 'No simulated result yet',
    emptyDescription:
      'Run the model to replace this empty state with real percentile bands.',
    running: 'Calculating percentile bands',
    runningDescription: 'The page remains available while the Worker runs the model.',
    ariaLabel: (mode: string) =>
      `Fan chart of simulated portfolio value percentiles in ${mode}`,
    ariaDescription: (
      mode: string,
      months: number,
      median: string,
      p05: string,
      p95: string,
    ) =>
      `Nested percentile bands in ${mode} over ${String(months)} months. The final median is ${median}; the final P5 to P95 range is ${p05} to ${p95}.`,
    valueModeLabel: 'Portfolio value basis',
    nominalMode: 'Nominal',
    realMode: 'Real',
    realAssumption:
      "Real values use deterministic inflation and are expressed in today's euros.",
    contributions: 'Contributed',
    timeAxis: 'time',
    inspectLabel: 'Inspect simulation period',
    inspectorEyebrow: 'Selected distribution',
    inspectorDescription: (mode: string) =>
      `Portfolio values across all seven percentiles in ${mode}`,
    note: (simulationCount: number) =>
      `${simulationCount.toLocaleString('en-IE')} seeded paths · simulated outcomes, not a forecast`,
    finalRange: (mode: string, p05: string, p95: string) =>
      `Final P5–P95 range in ${mode}: ${p05}–${p95}`,
    tableSummary: 'Review accessible percentile checkpoints',
    tableDescription:
      'A compact set of time checkpoints conveys the direction and widening of the simulated range without repeating every month.',
    tableCaption: (mode: string) =>
      `Key simulated portfolio-value checkpoints and contributed capital in ${mode}`,
    periodColumn: 'Period',
  },
  results: {
    title: 'Key results',
    label: 'Key simulation results',
    percentileLabel: 'Final value percentiles',
    finalValue: 'Median final value',
    contributed: 'Money contributed',
    growth: 'Median investment growth',
    awaiting: 'awaiting simulation',
    simulated: 'simulated outcome',
  },
  method: {
    eyebrow: 'Read the model, not just the number',
    title: 'Uncertainty is information.',
    description:
      'Each percentile is a position within simulated outcomes under a chosen set of assumptions. It is not a confidence guarantee or a market forecast.',
    disclaimer:
      'MarketSim is an educational simulation tool. It does not predict future market returns and does not constitute financial advice.',
  },
  units: {
    currencySymbol: '€',
    percent: '%',
    years: 'years',
    paths: 'paths',
  },
} as const;
