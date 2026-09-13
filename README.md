# MarketSim

**Make uncertainty visible.**

MarketSim is an offline-first educational tool for exploring the range of
outcomes produced by financial assumptions. It is being built milestone by
milestone. The current web application runs the independently testable pure
TypeScript simulation core in a dedicated Worker and presents inspectable real
percentile bands and statistics without blocking React.

> MarketSim is an educational simulation tool. It does not predict future
> market returns and does not constitute financial advice.

## Current scope

Milestone 5 adds an adaptive, keyboard/touch-inspectable quantitative fan chart,
a compact accessible checkpoint table, isolated engine and Worker profilers,
and one measured exact-statistics optimization. The engine remains independent
from React and browser APIs. Persistence, PWA, progress/cancellation, advanced
models, and native shells remain deferred.

## Development

Requirements: Node.js 22.12-24 and npm 11.

```text
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Run the complete local quality gate with `npm run check`.

Run the separate non-gating engine profiler with
`npm run profile:simulation`. For the real Worker profile, start `npm run dev`
and open `/worker-profile.html`; this diagnostic page is excluded from the
production build. Methodology and recorded results are in
`docs/performance-profiling.md`.

## Architecture and design

- `docs/architecture.md`
- `docs/visual-direction.md`
- `docs/simulation-model.md`
- `docs/decisions.md`
- `docs/implementation-status.md`
- `docs/performance-profiling.md`

The product has no mandatory backend, account, analytics, or hidden telemetry.
