# Performance profiling

Status: Milestone 5 measured baseline, optimization, and Worker profile.

Performance numbers are observations from one machine, not release guarantees.
The benchmark harnesses are deliberately separate from the normal test suite so
timing variance cannot make `npm test` or CI flaky.

## Reproduction

The engine profile is a Node/Vitest diagnostic run:

```text
npm run profile:simulation
```

It typechecks its own sources, enables explicit garbage collection for
best-effort before/after memory samples, performs one warm-up, and prints a JSON
report. Its `.profile.ts` file is excluded from normal Vitest discovery.

The Worker profile is served only by Vite at `/worker-profile.html`. The page is
not an input to the production Vite build. It executes the same job sizes through
the real module Worker and prints a JSON report including boundary timing and
isolated `structuredClone` measurements.

## Fixed benchmark job

All compared runs use the same inputs:

| Input                  | Value                              |
| ---------------------- | ---------------------------------- |
| Model                  | `monthly-lognormal-v1`             |
| Seed                   | `6d2b79f5aa41c83e19d4b760e5279c3a` |
| Initial capital        | 25,000                             |
| Monthly contribution   | 750                                |
| Annual expected return | 6.5%                               |
| Annual volatility      | 14%                                |
| Duration               | 120 months                         |
| Simulation counts      | 10,000; 50,000; 100,000            |
| Warm-up                | 2,000 paths, same 120-month job    |
| Measured repetitions   | 3 per count                        |

Engine environment: Node `v24.16.0`, Windows x64, AMD Ryzen 7 5700U, 16 logical
CPUs, approximately 14.87 GB system memory. Browser environment: Chromium 151 on
Windows x64, 16 logical CPUs.

## Engine baseline and optimized result

Full synchronous engine duration, in milliseconds:

| Paths   | Version   |  Average |   Median |  Minimum |  Maximum | Median change |
| ------- | --------- | -------: | -------: | -------: | -------: | ------------: |
| 10,000  | baseline  |  1,573.5 |  1,588.7 |  1,533.3 |  1,598.5 |             — |
| 10,000  | optimized |    922.0 |    904.2 |    891.8 |    970.2 |        −43.1% |
| 50,000  | baseline  | 10,600.8 | 10,634.2 | 10,319.5 | 10,848.6 |             — |
| 50,000  | optimized |  4,843.5 |  4,804.8 |  4,638.1 |  5,087.6 |        −54.8% |
| 100,000 | baseline  | 25,478.7 | 25,861.4 | 24,416.4 | 26,158.4 |             — |
| 100,000 | optimized |  9,913.0 |  9,678.4 |  9,500.0 | 10,560.5 |        −62.6% |

The profiler checksum was exactly `18091192071.94707` before and after the
optimization. This checksum is supporting evidence rather than the correctness
contract; exact equivalence is also covered by focused statistics tests and the
existing complete-result reproducibility suite.

## Stage analysis

Stage timings overlap and therefore must not be summed. Random-generation and
trajectory stages process all `N × 120` samples; the distribution measurement is
one monthly aggregation. At 100,000 paths, representative baseline medians were:

| Stage                                              |      Median |
| -------------------------------------------------- | ----------: |
| Validate the same job 1,000 times                  |     3.44 ms |
| Initialize and sample 10,000 seeded normal sources |    29.35 ms |
| Generate 12,000,000 uniform uint32 values          | 1,016.98 ms |
| Generate 12,000,000 standard normals               | 4,139.26 ms |
| Evolve all trajectories without monthly sorting    | 5,747.61 ms |
| One complete distribution aggregation              |   164.88 ms |
| Statistics after a pre-sorted distribution         |     1.70 ms |
| Build a 121-point trajectory shell                 |     0.07 ms |
| Serialize the final aggregate result               |     0.41 ms |

The original engine performed the complete distribution aggregation at month 0
and after each of 120 periods. Roughly 121 × 164.88 ms is about 19.95 seconds,
which explains most of the 25.86-second baseline. Validation, result construction,
and serialization are negligible. Box-Muller is meaningful within trajectory
evolution, but repeated copy-and-sort was the dominant bottleneck.

After the change, one complete 100,000-value aggregation measured a 42.23 ms
median under the same protocol. The remaining dominant costs are trajectory
evolution/normal generation and the still-exact monthly sort. More invasive
selection algorithms, sparse aggregation, batching, PRNG changes, and model
changes were deliberately rejected for this milestone.

## Optimization decision

The only production optimization replaces the temporary JavaScript `number[]`
distribution copy with a `Float64Array` copy and uses the typed array's numeric
sort. It retains:

- the same finite-value validation and copied-input behavior;
- the same ascending numeric ordering;
- the same Welford iteration order;
- the same Type 7 interpolation;
- the same monthly aggregation frequency;
- the same PRNG, Box-Muller transform, random-consumption order, and formulas.

A regression test compares the complete statistics object with the previous
numeric-array implementation on 2,003 deterministic nontrivial values. Existing
tests still cover same-job full-result equality, seeded serialization/reload,
fixed random vectors, convergence, and numerical errors. No model or randomness
version change is required because observable mathematical semantics do not
change.

## Worker profile

The actual Chromium module Worker ran the optimized fixed job three times after
warm-up. Median milliseconds:

| Paths   | Startup¹ | Request | Validation |  Engine | Response | Boundary |   Total |
| ------- | -------: | ------: | ---------: | ------: | -------: | -------: | ------: |
| 10,000  |    107.7 |     0.3 |        0.0 |   938.7 |      1.2 |      1.5 |   940.2 |
| 50,000  |    107.7 |     0.9 |        0.0 | 4,600.6 |      1.0 |      1.9 | 4,602.6 |
| 100,000 |    107.7 |     1.7 |        0.0 | 9,820.9 |      1.1 |      2.8 | 9,823.7 |

¹ Worker startup is measured once from construction to the `ready` message and
repeated as run metadata; it is not incurred again by each warm run.

Full Worker totals and boundary spread, in milliseconds:

| Paths   | Total avg | Total median | Total min | Total max | Boundary avg | Boundary median | Boundary min | Boundary max |
| ------- | --------: | -----------: | --------: | --------: | -----------: | --------------: | -----------: | -----------: |
| 10,000  |     922.2 |        940.2 |     860.7 |     965.7 |         3.23 |             1.5 |          1.5 |          6.7 |
| 50,000  |   4,650.2 |      4,602.6 |   4,585.8 |   4,762.3 |         2.07 |             1.9 |          1.9 |          2.4 |
| 100,000 |   9,866.0 |      9,823.7 |   9,721.5 |  10,052.9 |         2.93 |             2.8 |          1.6 |          4.4 |

Isolated request clones rounded to 0.0 ms. Median result clones were 0.6, 0.7,
and 0.8 ms. Serialized results were approximately 31.3 KB at every path count,
confirming that the Worker transfers monthly aggregates rather than raw paths.
The first measured 10,000-path dispatch was a 6.7 ms outlier; the reported
average/minimum/maximum remain available in the harness JSON output.

## Memory and complexity

Let `N` be path count and `M` duration in months:

| Data                                     | Complexity |    10k/120 |    50k/120 |   100k/120 |
| ---------------------------------------- | ---------- | ---------: | ---------: | ---------: |
| Live balance buffer                      | `O(N)`     |      80 KB |     400 KB |     800 KB |
| Temporary distribution copy, lower bound | `O(N)`     |      80 KB |     400 KB |     800 KB |
| Returned monthly aggregate trajectory    | `O(M)`     | 121 points | 121 points | 121 points |
| Hypothetical retained raw-path matrix    | `O(N × M)` |    9.68 MB |    48.4 MB |    96.8 MB |

The hypothetical matrix is **not allocated or retained**. The engine evolves one
balance per path in place and emits one fixed-size aggregate per month. Runtime is
`O(N × M)` for evolution plus `O(M × N log N)` for exact monthly sorting; working
memory is `O(N + M)`, and public/Worker result size is `O(M)`.

Post-run `process.memoryUsage()` deltas were intentionally recorded only as
best-effort observations, not peaks: garbage collection and V8 buffer retention
make heap/RSS deltas noisy. At 100,000 paths the three post-run heap deltas were
approximately 22.23 MB, 21.92 MB, and 22.02 MB. Browser `performance.memory` was
not exposed with useful values, so no unsupported browser peak-memory claim is
made.

## Limits of the measurements

- Three samples show the current cost shape but are not a device benchmark lab.
- Node and Chromium timings are not promises for Tauri, Capacitor, or mobile CPUs.
- Explicit GC improves comparability but does not reveal synchronous peak heap.
- Microbenchmarks identify cost centers; only full-pipeline before/after numbers
  establish the observed user-relevant improvement.
- Timing values are documentation, never pass/fail thresholds in the normal test
  suite.
