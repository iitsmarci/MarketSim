export function Guide() {
  return (
    <div className="guide-content" style={{ padding: 'var(--space-6) 0' }}>
      <div>
        <p className="eyebrow">User Guide</p>
        <h2
          id="guide-title"
          style={{ fontSize: 'var(--type-title)', margin: '0', color: 'var(--ink)' }}
        >
          How to use MarketSim
        </h2>
      </div>
      <div
        style={{
          marginTop: 'var(--space-6)',
          display: 'grid',
          gap: 'var(--space-6)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        }}
      >
        <article>
          <h3
            style={{
              fontSize: 'var(--type-heading)',
              color: 'var(--ink)',
              marginBottom: 'var(--space-2)',
            }}
          >
            1. Inputs & Assumptions
          </h3>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            Enter your initial capital, monthly contributions, and investment horizon.
            The tool uses a lognormal distribution based on your expected annual return
            and volatility. Inflation allows you to see the real purchasing power of
            your money over time.
          </p>
        </article>
        <article>
          <h3
            style={{
              fontSize: 'var(--type-heading)',
              color: 'var(--ink)',
              marginBottom: 'var(--space-2)',
            }}
          >
            2. What-If Scenarios
          </h3>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            Use the scenario comparison feature to compare two different strategies
            side-by-side. The scenarios use the same random seed, allowing you to
            isolate the impact of your decisions (like increasing contributions or
            changing risk profile) rather than random market noise.
          </p>
        </article>
        <article>
          <h3
            style={{
              fontSize: 'var(--type-heading)',
              color: 'var(--ink)',
              marginBottom: 'var(--space-2)',
            }}
          >
            3. Reading the Chart
          </h3>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            The fan chart visualizes the range of possible outcomes. The solid line
            represents the median (50th percentile). The shaded bands show the 10th to
            90th percentiles, giving you a clear view of both the expected case and
            extreme market conditions.
          </p>
        </article>
        <article>
          <h3
            style={{
              fontSize: 'var(--type-heading)',
              color: 'var(--ink)',
              marginBottom: 'var(--space-2)',
            }}
          >
            4. Save & Export
          </h3>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            You can save your current assumptions locally using the Scenario Manager.
            You can also export them to a JSON file to share with others or backup your
            data, and import them back at any time. All data remains on your device.
          </p>
        </article>
      </div>
    </div>
  );
}
