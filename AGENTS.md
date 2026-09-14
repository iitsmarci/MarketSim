# MarketSim contributor guide

This file is the operational memory for maintainers and coding agents. Read it
before changing the repository, then read the documents under `docs/` that are
relevant to the current milestone.

## Product boundary

MarketSim is an offline-first educational Monte Carlo simulator. It helps users
understand ranges of possible outcomes; it does not forecast markets, promise
returns, or provide financial advice.

The following statement must remain visible in the product and documentation:

> MarketSim is an educational simulation tool. It does not predict future
> market returns and does not constitute financial advice.

Do not add a mandatory backend, account, remote financial-data dependency,
analytics, or hidden telemetry. Financial assumptions and saved scenarios are
local by default.

## Current state

- Milestone 0 (repository audit and architecture) is complete.
- Milestone 1 (project foundation and visual system) is complete.
- Milestone 2 (simulation engine and domain contracts) is complete.
- Milestone 3 (seeded randomness and reproducibility) is complete.
- Milestone 4 (Web Worker and real UI simulation) is complete.
- Milestone 5 (quantitative visualization and performance profiling) is
  complete.
- Milestone 6 (deterministic inflation and real values) is complete. Its
  real-browser QA matrix remains explicitly unverified because the available
  browser environment could not access the local Vite server.
- The starting directory was empty and was not a Git repository.
- Git is initialized on `main`; the initial baseline commit captures the
  approved Milestone 0-5 implementation.
- npm workspaces contain the React/Vite web application and the focused
  MarketSim UI package. The representative screen now uses real engine output.
- `packages/domain` owns the validated inflation-aware `SimulationConfig`,
  immutable current and legacy result/job contracts, schema/model/randomness identifiers,
  canonical 128-bit hexadecimal seed, percentile keys, and input limits.
- `packages/simulation-engine` implements the synchronous monthly lognormal
  model, end-of-month contributions, trajectory aggregation, Type 7
  percentiles, final distribution statistics, xoshiro128** 1.1, and midpoint
  Box-Muller normal sampling with no React or browser dependency. It derives
  deterministic price indices, real aggregates, and payment-time-deflated real
  contributions after the unchanged nominal pass. A measured
  typed-array distribution copy preserves exact statistics while reducing the
  dominant monthly aggregation cost.
- Strict TypeScript, ESLint, Prettier, Vitest, Testing Library, root quality
  scripts, and a production web build are configured and verified.
- `simulate(job)` requires an explicit valid seed and produces reproducible
  complete results under the documented model/randomness contract. It has no
  ambient-randomness fallback.
- `apps/web` owns a typed module Worker boundary, lifecycle/error state,
  inspectable nominal/real percentile fan chart, adaptive accessible checkpoint
  table, and matching final results. React does not execute the engine on the main thread.
  Worker metrics separate startup, dispatch, validation, engine, response, and
  total duration.
- Engine and real-Worker profilers are isolated from ordinary tests. See
  `docs/performance-profiling.md` for fixed-job 10k/50k/100k measurements,
  memory complexity, bottleneck evidence, and limitations.
- No persistence, PWA, or native wrapper exists yet. Progress and cancellation
  are protocol extension points, not implemented features.
- See `docs/implementation-status.md` for the authoritative checklist and
  verified state.

Never describe a target architecture item as implemented unless the status
document records evidence for it.

## Architecture rules

1. Mathematical correctness precedes feature breadth and visual polish.
2. Keep the simulation engine pure TypeScript, deterministic for an explicit
   seeded job, independent of React and browser APIs, and callable without a
   Worker.
3. Never use `Math.random()` in simulation code. Randomness enters through a
   typed source backed by the versioned seeded implementation.
4. UI code may consume public engine contracts but must not contain core
   financial mathematics.
5. Validate at system boundaries. Reject non-finite, nonsensical, or
   unsupported inputs with human-readable errors.
6. Preserve explicit units in names and types (`annualReturn`,
   `monthlyContribution`, `durationMonths`); never mix annual and monthly
   quantities implicitly.
7. Persist `schemaVersion`, `modelVersion`, seed, currency, and configuration
   with every exported scenario.
8. Platform shells must reuse the web UI and shared packages. Do not fork the
   mathematical model for web, desktop, or mobile.
9. Storage must be accessed through a `StorageAdapter`; application code must
   not depend directly on IndexedDB, Tauri filesystem APIs, or Capacitor APIs.
10. Add dependencies only with a documented need and check compatibility with
    browser, Worker, Tauri, and Capacitor targets.
11. Treat visual identity and information design as architecture. Preserve the
    direction in `docs/visual-direction.md`; do not fall back to generic SaaS
    dashboard patterns or postpone UI quality to a final polish phase.

## Planned repository structure

Directories are created only when their milestone needs real files; do not add
empty placeholder trees.

```text
apps/
  web/                    React + TypeScript + Vite application and Worker
  desktop/                Tauri 2 host for the built web application
  mobile/                 Capacitor host; iOS project generated on macOS
packages/
  shared/                 dependency-light cross-cutting primitives
  domain/                 scenario, units, versions, and public contracts
  simulation-engine/      pure deterministic mathematics and statistics
  storage/                StorageAdapter and platform implementations
  ui/                     accessible design-system components and tokens
docs/
tests/                    cross-package integration and end-to-end tests
```

The intended dependency direction is:

```text
shared <- domain <- simulation-engine
             ^
             +---- storage

shared <- domain <- ui

apps compose packages; packages never import from apps.
```

No circular package dependencies are allowed.

## Conventions for future code

- TypeScript strict mode; no `any` without a local written justification.
- Explicit types at public boundaries; small, cohesive modules; pure functions
  for validation, conversions, simulation, and statistics.
- Prefer immutable inputs and results. Typed arrays are allowed internally for
  measured performance needs and must not leak as mutable shared state.
- English is the source language. UI copy must go through the localization
  boundary once UI work begins; calculations never depend on translated text.
- Currency is display metadata, not a factor in return calculations.
- Use semantic HTML, visible focus, keyboard support, 44 px-class touch
  targets, adequate contrast, and `prefers-reduced-motion` from the first UI
  milestone.
- Do not commit secrets, `.env` files, generated builds, credentials, signing
  assets, or machine-specific configuration.
- Make logical commits once Git is initialized; do not rewrite unrelated user
  changes.

## Commands

Use the root scripts as the stable contributor and future CI entry points:

```text
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run check
npm run profile:simulation
```

`npm run profile:simulation` is a diagnostic command, not part of
`npm run check` or a timing gate.

Record any change to these commands here and in the root README when it exists.

## Milestone protocol

For every milestone:

1. Inspect the repository, current documentation, status, and working tree.
2. Write a short plan scoped to that milestone.
3. Implement only the scoped work; preserve already-working decisions.
4. Run the relevant lint, typecheck, tests, build, and visual checks.
5. Fix actual failures rather than hiding or weakening checks.
6. Update `docs/implementation-status.md` and any affected architecture,
   decision, or mathematical-model documentation.
7. Report completed work, changed files, verification, known issues, and the
   next milestone.

A feature is complete only when it is implemented, integrated, tested,
regression-safe, documented where needed, visually verified when applicable,
and recorded as complete in the status document.

## Platform constraints

- Web must become installable and usable offline after its first successful
  load, with no account requirement.
- Desktop uses Tauri 2 only after the web core is stable. Native file access is
  isolated behind adapters.
- Capacitor prepares the mobile shell. Creating, building, signing, and fully
  validating the iOS target requires macOS, Xcode, and Apple signing assets.
  Never claim iOS build readiness from a Windows-only verification.

## Source documents

- `docs/architecture.md`: target boundaries, data flow, platforms, and testing.
- `docs/simulation-model.md`: mathematical contracts and formulas.
- `docs/inflation-model.md`: implemented M6 deterministic inflation and
  real-value semantics.
- `docs/visual-direction.md`: visual identity, interaction, chart, and layout
  rules.
- `docs/decisions.md`: accepted architecture decisions and their trade-offs.
- `docs/implementation-status.md`: milestone evidence and remaining work.
