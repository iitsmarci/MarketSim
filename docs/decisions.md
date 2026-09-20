# Architecture decisions

Decisions are append-only records. A superseded decision remains in this file
with a link to its replacement. Status values are `proposed`, `accepted`,
`superseded`, or `rejected`.

## ADR-001: Use an npm-workspaces TypeScript monorepo

- Status: accepted
- Date: 2026-09-12

### Context

The starting directory is empty. The product needs a web application, reusable
domain and simulation packages, and later native hosts. Node, npm, and Corepack
are available locally, but there is no existing package-manager decision.

### Decision

Use npm workspaces with a single root lockfile. Pin the supported Node range and
the package-manager version when Milestone 1 creates `package.json`.

### Consequences

- Contributors use already-available tooling and one install/build entry point.
- Package boundaries can be exercised without a separate monorepo orchestrator.
- We defer Turborepo/Nx and pnpm-specific features until measured repository
  scale justifies another tool or an explicit replacement ADR.

## ADR-002: One React/Vite web UI, reused by native shells

- Status: accepted
- Date: 2026-09-12

### Context

Web, desktop, and iOS are desired, but duplicated UI and simulation logic would
create divergent behavior and verification costs.

### Decision

Build one React + TypeScript + Vite application. Tauri 2 and Capacitor will host
the compiled web application and contribute capabilities through adapters.

### Consequences

- Most behavior and accessibility work is shared.
- Responsive design must be intentional; sharing code does not mean stretching
  one layout across every form factor.
- Native APIs cannot leak into shared features. Platform-specific behavior is
  isolated at adapter/composition boundaries.

## ADR-003: Keep the simulation engine pure and deterministic

- Status: accepted
- Date: 2026-09-12

### Context

Reproducibility, mathematical testing, Worker execution, and reuse across
platforms are foundational product requirements.

### Decision

Implement the engine as framework-free TypeScript. It accepts validated,
versioned configuration and an explicit seed, and it returns data without side
effects. It imports no React, DOM, Worker, storage, network, filesystem, clock,
locale, or native APIs. Randomness is injected/owned through a specified seeded
PRNG; `Math.random()` is forbidden.

### Consequences

- The same reference calculation can run synchronously in unit tests or inside
  a Worker.
- Progress/cancellation need a deterministic batched orchestration interface.
- Engine results must stay formatting- and localization-neutral.

## ADR-004: Model monthly lognormal growth with end-of-month contributions

- Status: accepted for the initial implementation
- Date: 2026-09-12

### Context

The MVP needs a simple, teachable return model with annual user assumptions,
monthly contributions, and non-negative pre-contribution portfolio values.

### Decision

Interpret the return input as an effective annual expected simple return.
Convert it to monthly lognormal parameters so the model's expected one-year
growth factor is `1 + r`, scale annual volatility by `sqrt(12)`, and add the
monthly contribution after applying each month's return. Use independent,
constant-parameter innovations for the first version.

Exact formulas and limitations are in `docs/simulation-model.md`.

### Consequences

- The model is transparent and yields positive gross growth factors.
- It does not model fat tails, autocorrelation, changing regimes, or parameter
  uncertainty. UI education must make those limitations clear.
- Alternative distributions and event timing require explicit strategies or a
  new model version; they cannot silently alter existing reproducibility.

### Alternatives considered

- Normally distributed simple returns: easy to explain but permits returns
  below -100% and negative balances without extra policy.
- Historical bootstrap: useful later but requires data provenance, offline data
  packaging, and choices not needed for the first model.

## ADR-005: Separate schema version from mathematical model version

- Status: accepted
- Date: 2026-09-12

### Context

Saved JSON structure can evolve without changing calculations, while a formula,
PRNG, or iteration-order change can alter results without changing JSON shape.

### Decision

Persist `schemaVersion` and `modelVersion` independently, together with seed,
currency, and normalized configuration. Migrations change schema explicitly;
model compatibility is never inferred from schema alone.

### Consequences

- Old scenarios can be migrated without falsely promising identical results
  under a changed model.
- Export/import and engine APIs must reject unsupported versions clearly.

## ADR-006: Use a storage adapter and local-first defaults

- Status: accepted
- Date: 2026-09-12

### Context

The app must work without accounts or remote infrastructure while supporting
different persistence capabilities in browsers, desktop, and mobile.

### Decision

Define a version-aware `StorageAdapter`. Implement IndexedDB, Tauri filesystem,
and Capacitor-backed variants only in their relevant milestones. No feature may
directly couple itself to a concrete persistence API.

### Consequences

- Persistence is testable with an in-memory adapter.
- Native storage can evolve without forking features.
- Imports are treated as untrusted versioned data and validated before storage.

## ADR-007: Keep Worker orchestration outside the engine

- Status: accepted
- Date: 2026-09-12

### Context

Large runs must not block the UI, but coupling calculations to browser Worker
globals would harm testability and platform reuse.

### Decision

The engine remains synchronously callable and provides deterministic batching
where needed. `apps/web` owns a typed Worker protocol, progress, cancellation,
job identity, stale-result handling, and transferable-data choices.

### Consequences

- Unit tests use the engine without browser infrastructure.
- Worker and direct execution must have equivalence tests.
- Batch boundaries cannot change the random sequence or numerical result.

## ADR-008: Defer concrete libraries until their implementation milestone

- Status: accepted
- Date: 2026-09-12

### Context

The empty repository offers no evidence for choosing charting, storage, PWA,
property-testing, localization, or native plugins during an architecture-only
milestone.

### Decision

Document required capabilities and selection criteria now; select and install a
library only when a milestone can integrate, test, and maintain it.

### Consequences

- Milestone 0 adds no runtime dependencies or speculative scaffolding.
- Later decisions must record bundle size, maintenance, accessibility,
  platform compatibility, and the native/browser alternative considered.

## ADR-009: Use React state before adding a global state library

- Status: accepted
- Date: 2026-09-12

### Context

The initial application flow is a form, a simulation job, a result, and local
scenario persistence. There is no demonstrated need for Redux, Zustand, or a
similar dependency.

### Decision

Start with component state and narrowly scoped contexts/services. Revisit only
when real cross-feature state transitions become difficult to reason about or
test.

### Consequences

- The initial dependency and abstraction surface stays small.
- State transitions and side effects still require explicit boundaries and
  integration tests.

## ADR-010: Treat visual identity as foundation architecture

- Status: accepted
- Date: 2026-09-12

### Context

MarketSim's ability to explain uncertainty depends on hierarchy, chart language,
interaction clarity, and restraint. Deferring these choices would let generic
dashboard patterns harden into the component and application structure.

### Decision

Define the visual direction and semantic tokens before implementing reusable UI
primitives. Build one representative simulation workspace—assumptions, action,
main uncertainty visualization, and key results—as the visual acceptance fixture
for later screens. The fan chart and product mark share the same nested-band
language. Full specifications live in `docs/visual-direction.md`.

### Consequences

- UI/UX quality is evaluated during each feature milestone, not in a final polish
  pass.
- The initial UI package remains small and specific to MarketSim rather than
  attempting to become a generic component catalog.
- Future components must be reviewed in the reference screen and both themes
  before their API is generalized.
- Illustrative output is labeled until a verified engine supplies real results.

## ADR-011: Use a current, small web quality toolchain

- Status: accepted
- Date: 2026-09-12

### Context

The web foundation needs strict compilation, production bundling, component
tests, formatting, React correctness rules, and JSX accessibility rules. The
standard `eslint-plugin-jsx-a11y` release did not accept the current ESLint 10
peer range during installation.

### Decision

Use React 19, Vite 8, TypeScript 6, Vitest 5, Testing Library, Prettier 3, and
ESLint 10. Use the maintained `eslint-plugin-jsx-a11y-x` compatibility fork for
static JSX accessibility rules. Keep chart rendering as application-owned SVG
for the foundation rather than adding a chart dependency before real data and
interaction requirements exist.

The root `package-lock.json` is the exact dependency record; major versions in
this ADR explain the compatibility boundary rather than replacing the lockfile.

### Consequences

- Root scripts provide one deterministic quality gate for all workspaces.
- Test worker concurrency is limited to one per workspace on Windows after the
  initial parallel run exposed process-startup timeouts.
- The accessibility fork is a deliberate dependency and must be re-evaluated
  when its upstream package supports ESLint 10 or the fork becomes unmaintained.
- A future chart library still requires a separate evidence-based decision.

## ADR-012: Stage seeded generation behind a standard-normal source

- Status: accepted; implementation refined by ADR-013
- Date: 2026-09-12

### Context

Milestone 2 must make the path evolution real and independently testable, while
the concrete seeded PRNG and normal transform explicitly belong to Milestone 3.
Letting the engine find randomness globally would couple the two milestones and
make deterministic tests fragile.

### Decision

Define a minimal `NormalRandomSource` interface with
`nextStandardNormal(): number`. During Milestone 2, require it in
`SimulationOptions`, consume samples in fixed month-major/path-major order, and
consume no samples when volatility is zero. Do not provide a `Math.random()` or
clock-based fallback.

Milestone 3 implements the named seeded uniform generator and normal transform
behind this interface and adds seed metadata at the versioned job boundary; see
ADR-013.

### Consequences

- Closed-form and controlled-sequence engine tests are deterministic now.
- PRNG selection can be reviewed with stable vectors without rewriting path
  evolution, statistics, or contribution timing.
- Callers cannot accidentally run a stochastic simulation with ambient or
  hidden randomness.
- Milestone 2 results are deterministic for the supplied source state, but do
  not yet claim seed-level reproducibility.

## ADR-013: Use xoshiro128** 1.1 with midpoint Box-Muller sampling

- Status: accepted
- Date: 2026-09-12

### Context

MarketSim needs an explicit, fast, dependency-free generator that behaves
predictably in JavaScript, Workers, and webviews. The seed must serialize
losslessly, the normal transform must handle uniform endpoints safely, and
algorithm changes must be detectable through fixed vectors and version
metadata.

### Decision

Use xoshiro128** version 1.1 for uniform uint32 generation. Represent its four
state words as exactly 32 hexadecimal digits in big-endian textual word order,
normalize to lowercase, and reject the all-zero state. This directly provides a
128-bit seed without an additional seed-expansion algorithm or unsafe numeric
conversion.

Map each uint32 word `w` to `(w + 0.5) / 2^32`, strictly inside `(0, 1)`. Apply
the standard Box-Muller transform to pairs and cache the sine variate after
returning the cosine variate. Identify the combined contract as
`xoshiro128ss-1.1-box-muller-v1` and include it with the seed in results.

Keep `NormalRandomSource` and `Uint32RandomSource` as narrow seams. The public
`simulate(job)` path always creates the versioned seeded source; it never falls
back to ambient randomness.

Pin this randomness algorithm to `monthly-lognormal-v1`. A change to the PRNG,
uniform mapping, transform, cache order, or simulation consumption order must
introduce a new model version rather than reinterpret an existing job.

### Consequences

- The uint32 transition is portable through explicit `Math.imul`, shifts,
  rotations, XOR, and unsigned normalization.
- Seeds round-trip through JSON exactly and expose the complete initial PRNG
  state.
- Midpoint uniforms prevent `log(0)`, while Box-Muller caching halves uniform
  consumption and makes ordering part of the compatibility contract.
- The finite 32-bit uniform grid limits the Box-Muller radius to approximately
  6.764 standard deviations; this is documented and tested.
- The generator is appropriate for simulation but not cryptographic use.
- Cross-JavaScript-engine bit equality of transcendental functions is not
  claimed until vectors run on each supported WebView family.

### Alternatives considered

- A single-word generator such as Mulberry32: smaller state and weaker safety
  margin for a long-lived reproducibility contract.
- PCG with 64-bit state: strong option, but faithful JavaScript implementation
  would require BigInt or more complex paired-word arithmetic.
- Web Crypto or platform randomness: useful for creating new seeds outside the
  engine, but intentionally nondeterministic and not a simulation PRNG.
- Inverse-CDF or ziggurat normal sampling: viable future choices, but more table
  or approximation policy than the transparent two-uniform transform requires.

## ADR-014: Use a typed module Worker and render bounded aggregate data

- Status: accepted
- Date: 2026-09-13

### Context

The real 10,000-100,000-path engine must not block React rendering. The result
already contains monthly aggregates, so the browser needs neither raw paths nor
a second mathematical implementation. Errors and timing also need to cross the
Worker boundary without exposing stacks or reducing failures to strings.

### Decision

Keep the engine unchanged and instantiate it only inside a Vite module Worker.
Use discriminated `run`, `accepted`, `completed`, and `failed` messages keyed by
an incrementing request ID. A run carries the complete versioned
`SimulationJob`; completion carries the complete `SimulationResult` plus the
engine duration measured inside the Worker. The client measures total duration
and derives boundary overhead.

Validate again inside the Worker, catch every thrown value, and serialize a
stable error code, user-safe message, and selected technical fields. Do not
send stack traces to the UI. Keep the seed solely in `SimulationJob`; the
Worker has no random fallback.

Render the existing bounded monthly percentile contract directly with a
hand-authored accessible SVG and yearly HTML table. Do not add a chart library
until interactions or chart types justify its weight. Remove the unimplemented
inflation control rather than letting it imply behavior absent from the domain
contract.

### Consequences

- React remains responsive while the synchronous reference engine runs off the
  main thread.
- Protocol unions and `accepted` leave a compatible extension point for later
  progress/cancellation, but neither behavior is implemented prematurely.
- Structured cloning transfers only horizon-sized aggregate output; measured
  warm-Worker boundary overhead is single-digit milliseconds in the current
  environment.
- Exact monthly percentile calculation is intentionally unchanged. Current
  30-year 50k/100k timings are long and become baseline evidence for a later
  performance milestone.
- Worker execution is browser-specific application code; domain and engine
  packages remain free of React, DOM, and Worker dependencies.

## ADR-015: Optimize exact distribution aggregation only after profiling

- Status: accepted
- Date: 2026-09-13

### Context

The Milestone 4 browser baseline showed long 50,000- and 100,000-path runs, but
did not isolate the cause. Changing percentile algorithms, checkpoint frequency,
or random generation without evidence could improve one measurement while
silently changing reproducibility or mathematical semantics.

The Milestone 5 profiler holds seed, model, assumptions, duration, and
environment constant, performs warm-up and three repetitions, and times the
full pipeline plus overlapping cost centers. At 100,000 paths and 120 months,
trajectory evolution without aggregation had a 5.75-second median, while one
baseline distribution aggregation had a 164.88 ms median and ran 121 times.

### Decision

Keep monthly aggregation, Welford statistics, ascending numeric order, and Type
7 interpolation unchanged. Replace only the temporary JavaScript `number[]`
copy in distribution statistics with a `Float64Array` copy and its numeric
sort. Do not change PRNG state, Box-Muller, random consumption, formulas,
percentile definition, public contracts, or model/randomness versions.

Keep the profiling configuration outside ordinary test discovery. Timing
observations are documentation rather than CI thresholds. Record detailed
methodology, Worker measurements, and memory complexity in
`docs/performance-profiling.md`.

### Consequences

- Full-pipeline medians improved by 43.1%, 54.8%, and 62.6% at 10k, 50k, and
  100k paths respectively in the recorded Node environment.
- A focused test proves exact equality with the previous numeric-array
  statistics path; existing seeded full-result, vector, convergence, and error
  tests remain the compatibility guard.
- Working storage remains `O(N + M)` and no raw `O(N × M)` path matrix is
  retained or transferred.
- Exact monthly sort remains a significant cost. More invasive selection,
  sparse aggregation, batching, and model changes require separate evidence and
  decisions.

## ADR-016: Keep the quantitative fan chart application-owned and inspectable

- Status: accepted
- Date: 2026-09-13

### Context

The real aggregate contract already supplies all monthly percentile values. The
Milestone 5 chart needs accurate nested bands, adaptive horizons, useful point
inspection, mobile behavior, keyboard equivalence, and a designed accessible
alternative. Adding a general chart package would not remove the need to own
those semantics and would add dependency, bundle, and accessibility surface.

### Decision

Retain the hand-authored SVG and move geometry/tick/checkpoint preparation into
a pure chart presenter. Map P5/P10/P25/P50/P75/P90/P95 and contributed capital
directly from `SimulationResult.trajectory`; do not smooth, synthesize, or
interpolate financial values.

Use a crosshair plus persistent seven-percentile HTML data panel for pointer
inspection. Use a 44 px native range input with explicit Home/End, arrow, and
Page Up/Down handling as the keyboard/touch equivalent. Summarize the horizon
with adaptive checkpoints in a semantic table instead of dumping every month.
Keep essential duration and final P5-P95/P50 context in accessible text outside
the SVG.

### Consequences

- The chart remains a MarketSim-specific quantitative instrument rather than a
  generic dashboard component.
- Every displayed value is traceable to a real result point and is testable
  without rendering React.
- The data panel is not hover-only and essential values do not depend on color,
  pointer precision, animation, or SVG accessibility.
- A chart library remains unnecessary until a future chart type or interaction
  demonstrates capabilities this implementation cannot maintain safely.

## ADR-017: Derive deterministic real values after the nominal simulation

- Status: accepted
- Date: 2026-09-14

### Context

MarketSim needs a purchasing-power view without changing the approved nominal
return process, reproducibility contract, contribution timing, percentile
definition, or bounded-memory architecture. Stochastic inflation or indexed
cash flows would introduce additional economic assumptions and compatibility
surface beyond Milestone 6.

### Decision

Add a finite effective annual deterministic inflation assumption to job schema
2 and identify the complete model as `monthly-lognormal-inflation-v1`. Retain
schema-1 `monthly-lognormal-v1` jobs and their result schema unchanged. Convert
inflation geometrically with `log1p`/`expm1`, evaluate the month-0-based price
index in closed form, and derive real aggregates from nominal aggregates using
the positive scale `1/P[t]`.

Preserve existing top-level result fields as nominal. Result schema 3 adds one
parallel `realValues` section; each real trajectory point records its price
index. Deflate every fixed nominal contribution at its own payment checkpoint
when building the real contribution basis. The Worker transports the versioned
job/result without owning any financial math, and the UI selects one nominal or
real view of the existing fan chart.

### Consequences

- The nominal path loop, xoshiro128**, Box-Muller cache, month-major sample
  order, zero-volatility behavior, Welford statistics, and Type 7 percentiles
  remain unchanged.
- Zero-inflation current jobs have a nominal projection exactly equal to the
  corresponding legacy result; legacy jobs are never silently migrated.
- Real derivation is `O(M)`, needs no second Monte Carlo run or sort, keeps
  working memory `O(N + M)`, and keeps result/Worker payload size `O(M)`.
- Stochastic inflation, correlated inflation, and inflation-indexed
  contributions require separate future model and contract decisions.

## ADR-018: Compare scenarios with paired application-level jobs

- Status: accepted
- Date: 2026-09-14

### Context

A what-if comparison should reduce avoidable sampling variation while allowing
the assumptions, including duration, to differ. It must not create a new
mathematical model, persistent scenario schema, or second engine implementation.
The approved engine and Worker already accept fully versioned deterministic
jobs.

### Decision

Represent Scenario A and Scenario B as ephemeral `apps/web` assumption drafts.
Build and validate two ordinary `SimulationJob` values. Both jobs use the
canonical seed, model version, monthly granularity, and simulation count.
Initial capital, monthly contribution, expected return, volatility, inflation,
and horizon remain independently editable. Validate both jobs before dispatch;
then use the same `SimulationWorkerClient` to await A before dispatching B.
Publish the comparison only after both complete, preserve stale-result
protection, and attribute structured execution errors to the active scenario.

Derive comparison values only from exact monthly `SimulationResult`
checkpoints. The shared timeline ends at `max(MA, MB)` and explicitly includes
`min(MA, MB)`. After a scenario ends, its value and the delta are unavailable;
never interpolate or extrapolate. Report contributed capital and
P5/P10/P25/P50/P75/P90/P95 as A, B, and `B - A` at the same checkpoint in the
existing nominal or real basis. This delta is a difference between aggregate
quantiles, not a quantile of the pathwise `B - A` distribution.

Use synchronized small-multiple fan charts with one scale and selection. Each
panel stops at its own horizon and preserves nested percentile bands, P50, and
contributions. Semantic inspector, checkpoint, and final-result tables remain
the authoritative exact representations; panel labels and border/line styles
supplement color.

### Consequences

- Common random numbers make repeated paired comparisons deterministic and
  reduce sampling variation between comparable checkpoints; they do not remove
  Monte Carlo uncertainty, make either outcome a forecast, or imply causal
  certainty. When only duration differs, the shorter result is an exact prefix
  of the longer result under the unchanged engine contract.
- Engine formulas, RNG consumption, job/result schemas, and Worker protocol are
  unchanged.
- Runtime is the sum of the two sequential simulations; only one engine run is
  active at a time, while retained aggregate results remain bounded by the two
  horizons rather than raw path count.
- Scenario drafts disappear on reload. Persistence, history, import/export,
  share URLs, progress, and cancellation remain separate milestones.
- Comparison orchestration and presentation remain application-owned; domain
  and simulation packages gain no UI workflow concepts.
