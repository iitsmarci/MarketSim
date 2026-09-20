# MarketSim

**Make uncertainty visible.**

MarketSim is an offline-first educational tool for exploring the range of
outcomes produced by financial assumptions. It is being built milestone by
milestone. The current web application runs the independently testable pure
TypeScript simulation core in a dedicated Worker and presents inspectable
nominal or today's-euro percentile bands and statistics without blocking React.
Two editable what-if scenarios can be run sequentially with common random
numbers and compared through synchronized uncertainty views.

> MarketSim is an educational simulation tool. It does not predict future
> market returns and does not constitute financial advice.

## Current scope

Milestone 7 adds application-level Scenario A/B drafts and exact what-if
comparison for contributed capital and all seven percentiles in nominal or real
terms. Capital, contributions, return, volatility, inflation, and horizon are
independent; the jobs share the canonical seed, model, and path count. One
Worker runs A and then B, and synchronized small multiples stop at each
scenario's actual horizon. The existing engine, RNG, Worker protocol, and
domain schemas are unchanged. Persistence, history, import/export, PWA,
progress/cancellation, advanced models, and native shells remain deferred.

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
- `docs/inflation-model.md`
- `docs/decisions.md`
- `docs/implementation-status.md`
- `docs/performance-profiling.md`

The product has no mandatory backend, account, analytics, or hidden telemetry.
