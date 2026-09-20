# Implementation status

Last reviewed: 2026-09-20

This document distinguishes verified implementation from intent. A checked
item has evidence recorded below; an architecture description alone does not
complete a runtime feature.

## Capability checklist

- [x] Architecture
- [x] Simulation engine
- [x] Seeded RNG
- [x] Core Monte Carlo
- [x] Percentiles
- [x] Contributions
- [x] Inflation
- [x] Scenarios
- [ ] Market shocks
- [ ] Sequence of returns
- [ ] Portfolio simulation
- [ ] Correlation
- [ ] Costs
- [x] Web Worker
- [x] UI
- [x] Accessibility
- [ ] PWA
- [ ] Desktop
- [ ] iOS
- [ ] Import/export
- [ ] Documentation
- [ ] Tests
- [ ] CI
- [ ] Release preparation

`Documentation` remains unchecked because the milestone control and
mathematical documents are current, while complete user, API, platform, and
release documentation does not exist yet.

## Milestones

| Milestone                               | Status      | Evidence                                                                                                                           |
| --------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0. Repository audit + architecture      | Complete    | Audit below; `AGENTS.md`; `docs/architecture.md`; `docs/simulation-model.md`; `docs/decisions.md`                                  |
| 1. Project foundation + design system   | Complete    | npm workspace and lockfile; React/Vite shell; focused UI package; reference screen; documented and verified visual direction       |
| 2. Simulation engine + domain contracts | Complete    | Pure domain/engine packages; 37 focused tests; documented formulas, validation, aggregation, and randomness boundary               |
| 3. Seeded randomness + reproducibility  | Complete    | xoshiro128**/Box-Muller pipeline; versioned seeded job; fixed vectors, statistical sanity, and full-result reproduction tests      |
| 4. Web Worker + real UI simulation      | Complete    | Typed module Worker; validated real jobs/results; fan chart; structured states/errors; convergence, UI, and browser evidence       |
| 5. Quantitative visualization + profile | Complete    | Inspectable adaptive fan chart; accessible checkpoints; isolated engine/Worker profiling; measured exact-statistics optimization   |
| 6A. Inflation + real-value design       | Complete    | `docs/inflation-model.md`; approved deterministic-inflation and real-value specification                                           |
| 6. Inflation + real values              | Complete    | Runtime, tests, performance, docs, and local quality gate complete; real-browser QA explicitly deferred after an environment block |
| 7. What-if scenario comparison          | Complete    | Independent horizons; sequential paired Worker runs; seven-percentile small multiples and tables; 159-test local quality gate      |
| 8-20                                    | Not started | Persistence, PWA, native platforms, advanced models, and release implementation remain future work                                 |

## Milestone 0 audit

### Repository contents at start

- Working directory: `C:\Users\User\Desktop\MARKETSIM`.
- The directory contained no regular files, hidden files, or subdirectories.
- `git status` reported that the directory was not a Git repository.
- No `package.json`, lockfile, workspace configuration, source code, installed
  dependency tree, TypeScript configuration, Vite configuration, lint/format
  configuration, test configuration, `.env` file, README, or existing project
  documentation was present.
- There was consequently no existing framework, package manager decision,
  component library, test suite, or code-level architecture to preserve.

### Available local tooling observed

- Node.js `v24.16.0`
- npm `11.13.0`
- Corepack `0.35.0`
- Git `2.55.0.windows.3`
- Rust/Cargo were not found in the command path during the audit.

Tool availability is an environment observation, not a project version pin.
Milestone 1 subsequently declared supported engine versions in `package.json`
and recorded exact dependency resolution in `package-lock.json`.

### Dependency audit

There were no declared or installed project dependencies during Milestone 0.
Milestone 1 subsequently introduced only web-foundation dependencies and
recorded the toolchain decision. Tauri, Capacitor, charting, storage, and
property-testing dependencies still wait for the milestone that uses them.

### Decisions completed

- Adopt a TypeScript monorepo with npm workspaces.
- Use React + Vite for the shared web application.
- Keep the deterministic simulation engine framework- and platform-independent.
- Reuse the built web application in later Tauri 2 and Capacitor shells.
- Keep persistence behind a platform-neutral adapter.
- Start with a documented monthly lognormal-return model and explicit model
  versioning; implementation begins only in Milestone 2.
- Establish layered unit, integration, Worker, UI, accessibility, end-to-end,
  performance, and platform verification strategies.

See `docs/decisions.md` for rationale and alternatives.

## Verification log

| Date       | Scope                           | Result                                                                                                                                                                                     |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-12 | Recursive filesystem inspection | Empty starting directory confirmed                                                                                                                                                         |
| 2026-09-12 | Git inspection                  | Confirmed not initialized as a repository                                                                                                                                                  |
| 2026-09-12 | Stack/config/dependency audit   | Confirmed no project artifacts or dependencies                                                                                                                                             |
| 2026-09-12 | Documentation consistency check | Required Milestone 0 control documents present and internally cross-referenced                                                                                                             |
| 2026-09-12 | Milestone 1 dependency install  | npm lockfile created; install reported 0 vulnerabilities                                                                                                                                   |
| 2026-09-12 | Formatting                      | `npm run format:check` passed                                                                                                                                                              |
| 2026-09-12 | Lint                            | `npm run lint` passed with ESLint 10 and JSX accessibility rules                                                                                                                           |
| 2026-09-12 | TypeScript                      | `npm run typecheck` passed for web and UI workspaces in strict mode                                                                                                                        |
| 2026-09-12 | Component tests                 | `npm test` passed: 2 files, 3 tests                                                                                                                                                        |
| 2026-09-12 | Production build                | `npm run build` passed; Vite generated the web production bundle                                                                                                                           |
| 2026-09-12 | Browser: desktop themes         | 1440x1000 light and 1280x720 dark inspected; chart hierarchy and focus verified                                                                                                            |
| 2026-09-12 | Browser: responsive             | 820x1180 tablet and 390x844 phone inspected; no horizontal overflow                                                                                                                        |
| 2026-09-12 | Browser: interaction/console    | Six inputs, editable value, themes, disabled action, accessible names, and zero console errors verified                                                                                    |
| 2026-09-12 | Contrast and touch targets      | Key text/action pairs met 4.5:1 or better; visible mobile controls measured at least 44 px                                                                                                 |
| 2026-09-12 | Milestone 2 domain tests        | 1 file, 12 tests passed for valid and invalid configuration boundaries                                                                                                                     |
| 2026-09-12 | Milestone 2 engine tests        | 3 files, 25 tests passed for conversion, evolution, contributions, percentiles, statistics, and RNG abstraction                                                                            |
| 2026-09-12 | Dependency-boundary audit       | Domain has no package dependency; engine depends only on domain; no React, DOM, Worker, storage, or `Math.random()` usage                                                                  |
| 2026-09-12 | Milestone 2 quality gate        | `npm run check` passed: formatting, lint, strict typecheck, 40 total tests, package builds, and Vite production build                                                                      |
| 2026-09-12 | Milestone 3 seed/job tests      | Domain validation covers canonical 128-bit hex seeds, invalid/all-zero states, metadata versions, and combined issues                                                                      |
| 2026-09-12 | Milestone 3 RNG vectors         | Fixed xoshiro128** uint32 and Box-Muller normal vectors passed; same seed matched and different seeds diverged                                                                             |
| 2026-09-12 | Normal distribution sanity      | 200,000 deterministic values: mean -0.001368, population deviation 0.997618, min -4.534490, max 4.345160; all finite                                                                       |
| 2026-09-12 | Reproducibility integration     | Same seeded job produced structurally equal full results and survived a JSON serialize/reload round trip                                                                                   |
| 2026-09-12 | Milestone 3 dependency audit    | No dependency added; domain remains dependency-free and engine still depends only on domain                                                                                                |
| 2026-09-12 | Milestone 3 quality gate        | `npm run check` passed: formatting, lint, strict typecheck, 72 total tests, all package builds, and Vite production build                                                                  |
| 2026-09-13 | Worker protocol and adapter     | Typed run/accepted/completed/failed messages; boundary validation; structured validation/numerical/random/unexpected errors                                                                |
| 2026-09-13 | Worker/UI integration tests     | 13 web tests passed for job mapping, invocation, lifecycle, real output, refresh, validation, and accessible errors                                                                        |
| 2026-09-13 | Monte Carlo convergence         | 100,000 paths: theoretical mean 13,795.074286, empirical mean 13,783.541711, difference 11.532576 < tolerance 34.830094                                                                    |
| 2026-09-13 | Worker reproducibility          | Same seeded job is fully equal through the tested Worker adapter; repeated real browser Worker runs render identical aggregate data and SVG paths                                          |
| 2026-09-13 | Browser performance baseline    | 30 years: 10k 4.81 s total/4.62 s engine/185 ms boundary; 50k 28.45 s/28.45 s/3 ms; 100k 65.83 s/65.83 s/3 ms                                                                              |
| 2026-09-13 | Browser responsive/themes       | 1440x1000, 820x1000, and 390x844 inspected in light/dark; no horizontal overflow; chart remained legible and responsive                                                                    |
| 2026-09-13 | Browser interaction/a11y        | Running controls disabled, theme remained responsive, focus visible, controls at least 44 px, data table present, no console warnings/errors                                               |
| 2026-09-13 | Milestone 4 quality gate        | `npm run check` passed: Prettier, zero-warning ESLint, strict TypeScript, 84 tests, all package builds, and Vite Worker/web production bundles                                             |
| 2026-09-13 | M5 engine baseline              | Fixed 120-month job, 3 runs: medians 1.589 s/10k, 10.634 s/50k, 25.861 s/100k; repeated monthly distribution copy/sort identified as bottleneck                                            |
| 2026-09-13 | M5 measured optimization        | Packed `Float64Array` copy/sort retained exact statistics; medians 0.904 s/10k, 4.805 s/50k, 9.678 s/100k (43.1%/54.8%/62.6% reductions)                                                   |
| 2026-09-13 | M5 Worker profile               | Chromium, 3 warm runs: total medians 0.940 s/10k, 4.603 s/50k, 9.824 s/100k; boundary medians 1.5/1.9/2.8 ms; startup 107.7 ms once                                                        |
| 2026-09-13 | M5 clone and memory profile     | Result clone medians 0.6/0.7/0.8 ms and ~31.3 KB payload; no raw paths; working memory `O(N + M)`, result `O(M)`, runtime includes `O(M*N log N)`                                          |
| 2026-09-13 | M5 chart and interaction tests  | Pure mapping/ticks/checkpoints plus React pointer, touch-compatible, range-keyboard, seven-percentile inspector, Worker timing, and a11y coverage                                          |
| 2026-09-13 | M5 browser verification         | 1440x1000, 820x1000, 390x844 light/dark; 1/15/40-year axes; 44 px controls; visible focus; confined table scroll; no overflow or console errors                                            |
| 2026-09-13 | Milestone 5 quality gate        | `npm run check` passed: Prettier, zero-warning ESLint, strict TypeScript, 96 tests, all package builds, and Vite Worker/web production bundles                                             |
| 2026-09-13 | M6A mathematical design         | Audited formulas and deterministic inflation proposal recorded in `docs/inflation-model.md`; design only, no runtime code changed                                                          |
| 2026-09-13 | M6A quality gate                | Prettier, zero-warning ESLint, strict TypeScript, and all 96 existing tests passed; diff is documentation-only                                                                             |
| 2026-09-14 | M6 domain + engine              | Job schema 2/result schema 3; deterministic price index; parallel real aggregates; payment-time real contributions; legacy model retained                                                  |
| 2026-09-14 | M6 mathematical tests           | Domain 29 and engine 80 tests passed, including bounds/non-finite values, 1,200 months, RNG invariance, exact legacy nominal equality, and scaling                                         |
| 2026-09-14 | M6 Worker + UI tests            | Web 30 and UI package 1 tests passed for job/error transport, inflation input, real default, nominal/real chart/table/results, and zero inflation                                          |
| 2026-09-14 | M6 performance comparison       | Legacy/M6 120-month medians: 422.3/428.0 ms at 10k, 2,226.1/2,271.1 ms at 50k, 4,378.7/4,638.9 ms at 100k; 1.4%/2.0%/5.9% overhead                                                         |
| 2026-09-14 | M6 local quality gate           | Clean rerun of `npm run check` passed: Prettier, zero-warning ESLint, strict TypeScript, 140 tests, all package builds, and production web bundle                                          |
| 2026-09-14 | M6 browser verification         | Not executed: the configured browser rejected loopback/private-network access to the local Vite server; no viewport, theme, or console claim made                                          |
| 2026-09-20 | M7 comparison tests             | Web suite passed 49 tests covering independent horizons, max/common timelines, unavailable values, seven deltas, CRN prefix, A then B, errors, finals, modes, stale results, and semantics |
| 2026-09-20 | M7 local quality gate           | `npm run check` passed: Prettier, zero-warning ESLint, strict TypeScript, 159 tests, all package builds, Worker bundle, and production web bundle                                          |
| 2026-09-20 | M7 browser verification         | Attempted with the local Vite server; the configured browser blocked both `localhost` and `127.0.0.1`, so no viewport, theme, interaction, or console claim is made                        |

Browser visual checks complement, but do not replace, engine and behavioral
tests. All displayed values, chart paths, inspector values, and checkpoint rows
come from a real `SimulationResult`; no illustrative result geometry remains.

## Known issues and constraints

- The browser Worker is the only UI execution path. Direct Worker-thread
  execution is not available in the current jsdom test stack without a fragile
  polyfill, so automated tests cover protocol + adapter + engine separately;
  real browser smoke checks cover the actual module Worker and structured clone.
- The xoshiro uint32 transition is bit-stable across JavaScript runtimes.
  Box-Muller relies on runtime transcendental functions, so exact cross-WebView
  bit equality remains unclaimed until platform vectors run in those targets.
- Tests remains unchecked in the capability checklist because automated browser
  accessibility/end-to-end infrastructure and cross-platform vectors do not
  exist yet; the current UI still has behavioral and manual accessibility
  evidence.
- Performance measurements come from one Windows Ryzen 7 5700U environment and
  are observations, not targets or cross-device guarantees. The 100k/120-month
  optimized Worker median remains about 9.82 s, so large runs are not described
  as instant.
- Exact percentile aggregation still sorts every monthly distribution. The
  measured typed-array optimization removes the dominant avoidable allocation
  cost, but selection algorithms or sparse checkpoints were not introduced.
- Browser peak memory was not available. Node memory deltas and analytical
  buffer sizes are documented responsibly in `docs/performance-profiling.md`.
- Progress and cancellation are not implemented; the typed protocol can add
  them without moving Worker APIs into the engine.
- Milestone 6's real-browser matrix remains an explicitly deferred environmental
  verification because the configured browser denied access to the local Vite
  server. Automated UI/accessibility tests passed, but they are not substituted
  for desktop/tablet/mobile light/dark or console evidence.
- Milestone 7's real-browser matrix remains an explicitly deferred environmental
  verification because the configured browser blocked both `localhost` and
  `127.0.0.1`. Automated semantic, keyboard, and interaction checks passed, but
  they do not substitute for desktop/tablet/mobile, light/dark, overflow,
  focus, chart/table, nominal/real, or console verification.
- CI is not configured; the quality gate currently runs locally.
- Rust and Cargo must be installed before local Tauri work.
- iOS compilation/signing cannot be verified in the current Windows
  environment; it will require macOS, Xcode, and signing credentials.

## Next milestone

Milestone 7 is complete with its real-browser matrix explicitly deferred after
the recorded environment block. Milestone 8 may begin only after explicit
approval.
