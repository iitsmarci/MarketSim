# MarketSim architecture

Status: accepted architecture. Milestones 1 through 7 implement the npm
workspace, React/Vite web application, focused UI package, domain contracts,
synchronous deterministic engine, seeded randomness, browser Worker boundary,
the first real simulation workflow, quantitative chart inspection, and measured
performance tooling, deterministic inflation, parallel nominal/real results,
and paired what-if scenario comparison. Storage, PWA, desktop, and mobile
layers remain targets rather than implemented components.

## Goals

MarketSim must make uncertainty understandable while remaining mathematically
auditable, reproducible, offline-first, and portable. The architecture favors:

1. mathematical and functional correctness;
2. accessible information design and a coherent visual identity;
3. clear boundaries and testability;
4. maintainability and measured performance.

The application answers: “Given these assumptions, what range of outcomes
could occur?” It never treats a percentile or median as a forecast.

## System context

```text
User
  |
  v
Web UI (also hosted by Tauri / Capacitor)
  |
  +--> validation and scenario orchestration
  |       |
  |       +--> simulation Worker --> pure simulation engine
  |       |                              |
  |       |                              +--> deterministic result
  |       |
  |       +--> StorageAdapter --> local platform storage
  |
  +--> accessible charts, statistics, education, import/export
```

There is no required remote service. Platform shells add capabilities around a
single web application; they do not fork business or simulation logic.

## Target repository layout

```text
apps/
  web/
    src/
      app/                 routes, composition, localization, theme
      features/            simulation workflows and presenters
      workers/             Worker protocol and lifecycle
  desktop/                 Tauri 2 configuration and Rust host only
  mobile/                  Capacitor configuration and native projects
packages/
  shared/                  errors, result helpers, dependency-light utilities
  domain/                  units, scenarios, versions, public data contracts
  simulation-engine/
    src/
      config/              validation and normalized configuration
      random/              seeded PRNG and normal variate generation
      models/              versioned return-model strategies
      simulation/          path evolution and contribution timing
      statistics/          summaries and quantiles
      index.ts              deliberately small public API
  storage/
    src/                    adapter contract and platform implementations
  ui/
    src/                    tokens and accessible reusable components
docs/
tests/
  integration/
  e2e/
```

Only create these directories when a milestone adds meaningful content.

## Package boundaries

### `shared`

Contains small cross-cutting primitives with no React, financial-model, or
platform dependency. It must not become a miscellaneous dumping ground.

### `domain`

Owns public, serializable language shared between layers: units, currency
metadata, scenario configuration, validation issue shapes, schema/model version
identifiers, and import/export envelopes. It has no React or platform APIs.

### `simulation-engine`

Owns calculations, the randomness boundary, path evolution, aggregation, and
statistics. It may depend on domain contracts but not on UI, storage, Worker,
DOM, filesystem, network, locale, or wall-clock state. Its current API is:

```ts
simulate(job: SimulationJob): SimulationResult
simulate(job: LegacySimulationJob): LegacySimulationResult
```

`SimulationJob` contains job schema version, model version, explicit 128-bit
seed, and financial configuration. The engine constructs the production seeded
`NormalRandomSource`; an internal seam preserves controlled-source model tests.
The current result preserves nominal statistics and contributions at the top
level and adds a parallel `realValues` section. Its price-indexed monthly
trajectory and payment-time-deflated contribution basis are derived after the
unchanged nominal pass in `O(M)` time. Legacy schema-1/model-v1 jobs retain their
original result shape and meaning. Cancellation
and progress are orchestration concerns; a batched engine API may provide
deterministic checkpoints for the Worker without importing Worker APIs.

### `storage`

Defines a version-aware `StorageAdapter` for listing, reading, writing, and
deleting local scenarios. IndexedDB, Tauri filesystem, and Capacitor-backed
implementations remain behind this contract. Import/export migration is a pure
domain service and must validate untrusted JSON before persistence.

### `ui`

Owns visual tokens and accessible presentational primitives. Components accept
explicit view models and callbacks; they do not run simulations or access
storage. Chart data preparation belongs to feature presenters unless it is a
generic visualization transform.

### Applications

`apps/web` is the composition root and the only web UI implementation. It owns
feature state, Worker lifecycle, persistence selection, localization, routing,
theme, and error boundaries. `apps/desktop` and `apps/mobile` host the built web
assets and supply platform adapters through narrow interfaces.

## Dependency direction

Dependencies flow toward stable contracts:

```text
shared <- domain <- simulation-engine
             ^
             +---- storage
             +---- ui

apps/web ----> all required packages
apps/desktop -> built web app + native adapters
apps/mobile --> built web app + native adapters
```

The domain does not import implementations. Packages never import application
code. Cross-package cycles fail CI once tooling exists.

## Data flow

```text
localized user input
  -> parse to explicit numeric units
  -> validate and normalize configuration
  -> dispatch versioned job with explicit seed
  -> deterministic simulation model
  -> aggregate statistics and percentile series
  -> immutable result contract
  -> presenter formats currency and educational labels
  -> charts, summaries, and optional local persistence/export
```

Formatting never feeds back into calculations. Monetary values are represented
as finite JavaScript numbers in a declared currency for the first model; UI
formatting uses `Intl.NumberFormat`. If precision requirements later demand a
different representation, that is a versioned domain/model decision.

## Simulation engine design

### Input and normalization

External input is untrusted. Parsing UI strings, validating domain constraints,
and normalizing annual quantities are separate operations. Validation returns
all actionable issues where practical. Initial guardrails should constrain
duration, simulation count, rates, volatility, and values to documented ranges,
while the pure mathematical layer still rejects non-finite values.

### Randomness

Milestone 3 implements xoshiro128** 1.1 with a direct four-word 128-bit seed.
The seed is represented as a canonical 32-digit hexadecimal string so it is
lossless in JSON and does not cross JavaScript's safe-integer boundary. The
all-zero xoshiro state is rejected.

Uint32 output is mapped to midpoint uniforms strictly inside `(0, 1)` and then
converted in pairs with Box-Muller. The second normal value is cached. Both the
cache and month-major simulation consumption order are versioned and covered by
fixed vectors. Zero volatility consumes no samples.

No engine function reads `Math.random`, current time, crypto randomness,
locale, or global mutable state. Future UI seed creation occurs outside the
engine and must pass the seed explicitly.

### Return models

Expose a strategy boundary keyed by `modelVersion`, but implement only the
initial monthly lognormal model first. Historical bootstrap and regime models
are future strategies, not flags tangled into the initial loop.

### Evolution and aggregation

The engine advances balances monthly, with contributions applied at the end of
each month after that month's return. It calculates final exact summary values
and time-series percentiles for fan-chart checkpoints. Correctness comes first;
the balance buffer and measured distribution-copy optimization use typed arrays.
Batched execution and selection algorithms remain deferred. UI checkpoint
spacing is a presentation concern and never changes monthly engine aggregation.

Raw simulated paths are not part of the default public result. This avoids a
large transfer and rendering surface. A diagnostic option may expose bounded
sample paths without changing the statistical contract.

### Versioning and reproducibility

Every saved or exported scenario includes:

```text
schemaVersion
modelVersion
seed
currency
configuration
```

Reproducibility means the same supported model/randomness versions, canonical
seed, validated configuration, and sample-consumption order produce the same
complete result. Fixed uint32/normal vectors and full result-equality tests stop
PRNG, normal-cache, or iteration-order changes from silently altering results.
Each supported model version resolves to exactly one randomness algorithm; an
algorithm change requires a new model version even if the financial formula is
otherwise unchanged.

The xoshiro transition is bit-stable under JavaScript uint32 semantics.
Box-Muller uses standard IEEE-754 transcendental functions; committed vectors
must be run on each supported WebView family before claiming bit-identical
cross-engine output.

## Worker and performance architecture

The synchronous engine remains the reference implementation for tests and
non-browser calls. Milestone 4 adds one module Worker in `apps/web`; React never
imports or invokes the engine. Its discriminated protocol is:

```text
ready
run(requestId, SimulationJob)
  -> accepted(requestId)
  -> completed(requestId, SimulationResult,
               validationDurationMs, simulationDurationMs)
  -> failed(requestId, { code, message, technical })
```

The Worker emits `ready` after module startup. The client correlates responses
by `requestId` and measures startup, request dispatch, response transfer,
boundary, and total time; the Worker separately measures validation and engine
execution. The result contains
monthly aggregates rather than raw paths, so structured-clone cost is bounded
by the horizon rather than the number of simulations. `accepted` makes queueing
explicit and the discriminated unions can gain progress/cancellation messages
later. Progress, cancellation, batching, and multiple concurrent jobs are not
implemented in Milestone 4.

The Worker validates every job at the boundary and converts validation,
numerical, random-source, and unexpected failures to safe structured payloads.
It never owns or modifies randomness: the explicit job seed remains the only
production source of simulation randomness.

Milestone 5 profiles a fixed 120-month job at 10k, 50k, and 100k paths in Node
and the real Chromium Worker. It identifies repeated monthly distribution copy
and numeric sorting as the dominant baseline cost. Replacing only the temporary
`number[]` with a `Float64Array` reduces measured full-pipeline medians while
preserving the exact Type 7/statistics result and all model/randomness behavior.
Raw paths remain absent, working memory stays `O(N + M)`, and Worker payloads
stay `O(M)`. Methodology and observed numbers are in
`docs/performance-profiling.md`; they are not release targets or CI thresholds.

Milestone 6 keeps the protocol shape unchanged while carrying job schema 2 and
result schema 3. The deterministic price index introduces no Worker-owned math,
random source, second Monte Carlo pass, or raw-path transfer. A same-process
legacy/new benchmark isolates the measured cost of deriving real aggregates;
the result payload remains `O(M)`.

Milestone 7 validates both ordinary jobs before dispatch, then reuses one
`SimulationWorkerClient` to await Scenario A before dispatching Scenario B. The
explicit sequence bounds active engine work to one run and exposes distinct
running-A/running-B states. A validation failure dispatches neither job; an
execution failure is attributed to the active scenario. No new Worker message,
engine entry point, batching behavior, or progress/cancellation semantics are
introduced.

## Application state

Begin with local React state plus narrowly scoped context for stable app-level
services such as theme, localization, storage, and simulation runner. Do not add
a global state library until concrete cross-feature complexity justifies it.
Serializable scenario state may later use URL encoding only when size and
privacy constraints permit it.

Milestone 7 keeps Scenario A/B as ephemeral application drafts. Capital,
monthly contribution, return, volatility, inflation, and horizon remain
independent. A separate shared-settings value supplies canonical seed, model
version, and simulation count to both jobs. Editing either draft or the shared
path count invalidates the paired output so stale results are never presented as
a current comparison.

## Storage and privacy

- No account or network is required.
- Scenario values stay on the device unless the user explicitly exports them.
- IndexedDB is the planned web persistence mechanism, reached through
  `StorageAdapter`.
- Desktop and mobile implementations may use native storage without exposing
  native APIs to features.
- JSON imports are size-limited, schema-validated, migrated explicitly, and
  rejected safely when unsupported.
- Service-worker caches contain application assets, not remote financial data.

## UI and accessibility architecture

The visual hierarchy is assumptions -> simulation -> uncertainty ->
understanding. The fan chart is the primary result; summaries explain money
contributed, investment growth, nominal value, real value, and percentile ranges
without presenting P50 as a prediction.

Design tokens cover typography, spacing, color, chart palette, borders, radii,
shadows, focus, and motion. Light, dark, and system themes are designed and
tested independently. Charts provide non-color encodings and an accessible data
table or textual summary. Responsive layouts are content-driven and verified on
small mobile, phone, tablet, laptop, desktop, and wide desktop viewports.

The detailed direction in `docs/visual-direction.md` is an architecture input,
not a finishing checklist. New screens must preserve its structured-uncertainty
language and be exercised in the representative simulation workspace before a
component abstraction is broadened.

English copy uses stable localization keys from the first UI milestone; Italian
can be added without touching calculations. Currency formatting is metadata and
supports an eventual EUR/USD/GBP/CHF set.

Milestone 4 turns the representative workspace into the first real workflow.
Controlled inputs produce a validated `SimulationJob`, the Worker runs the
engine, and the UI renders real monthly P5/P10/P25/P50/P75/P90/P95 bands,
contribution reference, final statistics, and an accessible data table.
Idle, running, success, and structured error states are explicit. The fixed
Milestone 1 preview geometry and fake statistics have been removed.

Milestone 5 moves chart mapping into a pure presenter and adds adaptive time
ticks, a crosshair, an all-seven-percentile data inspector, a native range
control with explicit keyboard handling, pointer/touch inspection, a final-range
summary, and compact accessible checkpoints. The table is a designed trend
summary, not a dump of every monthly row. Chart interaction changes only the
selected view; it never recalculates or interpolates financial output.

Milestone 6 adds one accessible nominal/real selector. The presenter selects
the corresponding trajectory already present in `SimulationResult`; nominal
mode uses the existing cumulative nominal contribution line and real mode uses
the payment-time-deflated contribution basis. Non-zero inflation results open
in today's-euro mode, while zero inflation opens in nominal mode. The two modes
reuse one chart rather than overlaying duplicate fans.

Milestone 7 adds synchronized Scenario A/B small multiples with one vertical
scale, one selected month, and separate labeled panels. Each panel retains the
P5-P95, P10-P90, and P25-P75 bands, P50, and contribution reference, and stops
at its own horizon. The shared timeline ends at the longer horizon and includes
the shorter, maximum-common horizon as an explicit checkpoint. Persistent
semantic tables expose all seven percentiles plus contributions as A, B, and
`B - A`; unavailable values after the shorter horizon render as a dash. Deltas
are differences between aggregate quantiles at the same month, not quantiles of
a pathwise difference distribution. Pointer, native range, and explicit
keyboard controls never interpolate or extrapolate financial values.

## Platform architecture

### Web and PWA

Vite builds the application. A later service worker precaches versioned static
assets and supports offline startup after installation/first successful load.
Update handling must avoid mixing incompatible UI and Worker versions.

### Desktop

Tauri 2 hosts the same compiled web assets. Native commands are minimal,
allow-listed, and wrapped by TypeScript adapters. Desktop verification includes
resize, keyboard operation, import/export, native file permissions, and builds
on Windows, macOS, and Linux CI where feasible.

### Mobile and iOS

Capacitor hosts the same web application with intentional mobile layout,
safe-area insets, keyboard behavior, touch targets, lifecycle recovery, dark
mode, orientation, and storage adapters. Native project creation and iOS build
verification require macOS and Xcode; signing additionally requires Apple
credentials. Windows checks cannot establish iOS readiness.

## Testing strategy

### Static checks

- Strict TypeScript across workspaces.
- ESLint rules for correctness, React, hooks, and import boundaries.
- Formatting check and production build from root scripts.

### Engine unit and property tests

- annual/monthly conversion and contribution timing;
- zero-return closed-form balances;
- zero contributions, zero volatility, negative returns, and one-month cases;
- inflation deflation and nominal/real separation;
- deterministic PRNG test vectors and same-seed equality;
- different-seed sanity checks without asserting statistical certainty;
- Type-7 percentile interpolation, min/max/mean/median/deviation;
- model validation, non-finite values, extreme documented bounds;
- later: costs, shocks, portfolio weights, covariance, correlation, Cholesky,
  rebalancing, and single-asset equivalence.

Milestones 2 and 3 use closed-form, controlled-sequence, fixed-vector,
serialization, full-result equality, and deterministic statistical sanity tests
without adding a property-testing dependency. Property-based testing can be
introduced when it adds coverage beyond those invariants.

### Integration and Worker tests

Milestones 4 through 7 verify the Worker protocol/adapter, validation and error
serialization, same-job full-result equality at the adapter boundary, and real
browser execution. Milestone 5 additionally verifies separated timing metrics
and the production module-Worker profile. Milestone 6 additionally verifies
inflation-aware results and structured derived-value failures. Milestone 7 adds
same-client sequential request coverage, validation-before-dispatch, distinct
paired execution errors, and stale-result protection without changing the
protocol. Progress, cancellation, import/export
round trips, and schema migrations remain future integration coverage.

### UI and end-to-end tests

Test form validation, keyboard paths, focus management, screen-reader names,
theme selection, localization, chart alternatives, responsive layouts, reduced
motion, persistence, offline startup, and core simulation journeys. Milestone 5
adds exact chart-data mapping, adaptive horizon ticks, percentile ordering,
mouse/touch-compatible pointer inspection, explicit range-key handling, and
accessible checkpoint coverage. Milestone 6 tests inflation input mapping and
validation, nominal/real selection, data/table/result consistency, and the
zero-inflation default. Milestone 7 tests independent scenario horizons, shared
job invariants, common seeded prefixes, explicit A-then-B execution, exact
nominal/real A/B/deltas across all seven percentiles, maximum/common horizons,
unavailable values without interpolation, final results, stale-result clearing,
semantic tables, keyboard inspection, loading, and independent errors. Automated
accessibility checks supplement manual keyboard and screen-reader smoke tests.

### Numerical and performance verification

Use closed-form cases and committed golden vectors for exact behavior. Use
tolerance-based distribution checks only where exact values are inappropriate.
Benchmarks record duration, memory, responsiveness, device/browser, model
version, seed, horizon, and path count. The isolated engine and Worker harnesses
use warm-up plus repeated 10k/50k/100k measurements and do not run as brittle
timing gates on every unit-test job.

### CI stages

The initial CI remains simple: clean install, lint, typecheck, tests, and build.
Later jobs add browser end-to-end tests, platform matrices, security checks, and
release packaging only when those artifacts exist.

## Error handling

Domain errors use stable codes plus safe parameters; the UI owns localized
human explanations. Worker/native boundaries serialize a stable code, safe
message, and selected technical details. Stack traces are not sent to the UI.
Unexpected errors reach a recoverable state without exposing implementation
details.

## Deferred decisions

Storage library (if any), PWA tooling, and native plugin selection are decided
in the milestone that can
validate them. Deferral prevents architecture documents from becoming untested
dependency commitments. Simulation input bounds and the seeded randomness
pipeline are now defined and documented. Milestone 5 retains the hand-authored
SVG because the required quantitative interaction and accessibility were met
without a chart dependency.
