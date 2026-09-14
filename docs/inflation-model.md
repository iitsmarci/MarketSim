# Inflation and real-value model

Status: implemented in Milestone 6. This remains the normative mathematical
and domain specification for deterministic inflation and real values.

## Purpose and terminology

This specification extends MarketSim's educational monthly Monte Carlo model
with a deterministic purchasing-power lens. It does not model or forecast
inflation uncertainty. Nominal values are amounts in the currency units current
at their checkpoint. Real values are those amounts expressed in month-0
purchasing power, described in the product as **today's euros** (or today's
units of the selected display currency).

> MarketSim is an educational simulation tool. It does not predict future
> market returns and does not constitute financial advice.

The normative words **must**, **must not**, and **should** below define the M6
behavior. The implementation follows these constraints; deferred alternatives
remain explicitly out of scope.

## M5 compatibility baseline audit

### Domain contracts

Before M6, the legacy `SimulationConfig` contained exactly:

| Field                  | Current semantics                                                        |
| ---------------------- | ------------------------------------------------------------------------ |
| `initialCapital`       | Non-negative nominal balance at month 0                                  |
| `monthlyContribution`  | Non-negative fixed nominal amount deposited at every completed month end |
| `durationMonths`       | Integer number of complete monthly steps                                 |
| `annualExpectedReturn` | Effective annual expected simple return; `0.07` means 7%                 |
| `annualVolatility`     | Annualized standard deviation of nominal log returns                     |
| `simulationCount`      | Integer number of simulated paths                                        |

The retained legacy `SimulationJob` schema version 1 contains the model version, an explicit
canonical seed, and the configuration. The seed is execution metadata, not a
financial assumption. `SimulationResult` schema version 2 repeats the validated
job identity and adds the pinned randomness algorithm, contribution summaries,
final and investment-growth statistics, and the aggregated trajectory.

The trajectory has one point for month 0 and one for every completed month.
Every point contains the month, cumulative nominal money contributed, the
cross-path mean, and P5/P10/P25/P50/P75/P90/P95. Raw paths are not returned.

`initialCapital` is simultaneously nominal and real at month 0 because the
price-index base is 1. `monthlyContribution` has no escalation
or indexation semantics: the same nominal number is added at every month end.

### Nominal return process

The implemented model is `monthly-lognormal-v1`. For effective annual expected
simple return `r_n`, annualized nominal log-return volatility `sigma_a`, and an
independent standard-normal innovation `Z[t,j]` for month `t` and path `j`:

```text
sigma_m = sigma_a / sqrt(12)
mu_m = ln(1 + r_n) / 12 - 0.5 * sigma_m^2
G[t,j] = exp(mu_m + sigma_m * Z[t,j])
```

The drift correction gives:

```text
E[G[t,j]] = (1 + r_n)^(1/12)
E[product(G[1..12,j])] = 1 + r_n
```

The annual expected return is therefore already an effective annual expected
**nominal** simple return. Making the word nominal explicit does not reinterpret
the current formula; it supplies the missing contrast once real values exist.

`annualVolatility` remains the annualized volatility of nominal log returns.
Subtracting deterministic log inflation from a log return changes its location,
not its variance, so M6 needs no inflation-volatility input and no second return
volatility.

### Balance evolution and contribution timing

For every path, current execution is:

```text
B[0,j] = initialCapital
B[t,j] = B[t-1,j] * G[t,j] + C
```

where `C = monthlyContribution`. Return is applied first and the contribution is
added at the end of the month. The new contribution earns no return in that
month. All path balances are aggregated after the completed step. M6 must not
change this ordering.

Current cumulative nominal contributions are:

```text
D_n[t] = initialCapital + t * C
```

Final nominal investment growth is the final balance distribution shifted by
`-D_n[M]`. Its population standard deviation is unchanged by that shift.

### Aggregation and percentiles

At each checkpoint the engine copies the current `Float64Array`, sorts it in
ascending numeric order, computes population mean and standard deviation using
Welford updates, and computes percentiles using Type 7 interpolation:

```text
h = (N - 1) * p
lower = floor(h)
upper = ceil(h)
w = h - lower
q(p) = x[lower] * (1 - w) + x[upper] * w
```

The percentile definition, Welford order, monthly aggregation frequency, and
nominal trajectory must remain unchanged.

### Seed and random-sequence consumption

The seed is 32 hexadecimal digits representing the four uint32 state words of
xoshiro128** 1.1. `SeededNormalRandomSource` converts its uint32 stream to an
open uniform interval using bin midpoints and then uses Box-Muller, caching the
second normal from each pair.

With non-zero volatility, normal values are consumed month-major:

```text
month 1: path 0, path 1, ..., path N-1
month 2: path 0, path 1, ..., path N-1
...
```

For `K = durationMonths * simulationCount` normal values, Box-Muller consumes
`2 * ceil(K / 2)` uint32 values. At zero volatility it consumes none. M6 must
leave both counts and ordering unchanged.

## Inflation alternatives

### A. Deterministic inflation assumption

Add one effective annual inflation assumption and use it to construct a
deterministic price index.

Advantages:

- one understandable input;
- no false precision about inflation dynamics;
- no additional random parameters or correlation assumptions;
- stable reproducibility and inexpensive computation;
- direct explanation in today's purchasing power.

Limitations:

- inflation uncertainty, regime changes, and return/inflation dependence are
  outside the result distribution;
- the output is conditional on a constant inflation assumption.

### B. Independent stochastic inflation

Simulate a second random process for inflation.

Potential advantage: the bands could include inflation uncertainty. Material
disadvantages are a second mean/volatility model, a choice of distribution,
extra random consumption, an explicit stream-allocation policy, and a required
return/inflation dependence assumption. Declaring the processes independent is
not economically neutral and could make the visualization look more complete
without making it more credible.

This alternative is rejected for M6. It belongs to a later, separately
validated model alongside correlation and regime decisions.

### C. Deterministic deflation of nominal output

Keep the nominal simulation untouched and derive real values by dividing each
monthly nominal aggregate by a deterministic price index.

Advantages:

- nominal outputs remain traceable to the current engine;
- deterministic positive scaling preserves ordering and all percentile ranks;
- no raw paths or second aggregation pass are required;
- no random value is added, removed, or reordered;
- the distinction between market uncertainty and an inflation assumption stays
  visible.

Limitation: this is not a standalone inflation assumption; it needs the rate
and price index from alternative A.

### Decision

M6 should combine **A and C**: one deterministic effective annual inflation
assumption, with real values derived from the unchanged nominal aggregates.
Alternative B must not be implemented in M6.

## Inflation assumption and annual-to-monthly conversion

The proposed input is:

```text
annualInflation = i_a
```

It is the effective annual percentage change in the price level, expressed as a
decimal fraction. For example, `0.025` means that the price index is 2.5% higher
after 12 complete months, while `-0.02` means 2% annual deflation.

Simple division,

```text
i_a / 12
```

is only a linear approximation and would compound to a value different from
`1 + i_a`. It must not be the normative conversion.

Define the monthly log inflation, gross inflation factor, and effective monthly
inflation as:

```text
ell_i = ln(1 + i_a) / 12
F_i = exp(ell_i) = (1 + i_a)^(1/12)
i_m = F_i - 1
```

An implementation should evaluate `ell_i` with `log1p(i_a)` and `i_m` with
`expm1(ell_i)` for accuracy near zero.

## Price index and real values

Month 0 is the purchasing-power base:

```text
P[0] = 1
P[t] = F_i^t = exp(t * ell_i) = (1 + i_a)^(t/12)
```

Computing each checkpoint from `exp(t * ell_i)` is the normative numerical
definition. It avoids accumulating a separate iterative rounding drift while
remaining mathematically equivalent to `P[t] = P[t-1] * F_i`.

For a nominal path balance:

```text
R[t,j] = B[t,j] / P[t]
```

`R[t,j]` is the purchasing power of that balance in month-0 units. Therefore:

- at month 0, `R[0,j] = B[0,j]`;
- at the first month end, `R[1,j] = B[1,j] / F_i`;
- at the final checkpoint, `R[M,j] = B[M,j] / P[M]`;
- at 0% inflation, `F_i = P[t] = 1` and nominal and real values coincide;
- with positive inflation, a positive nominal amount has a lower real value;
- with permitted negative inflation, a positive nominal amount has a higher
  real value.

Because `P[t]` is deterministic and strictly positive, real aggregate
statistics should be derived from nominal aggregates using `s[t] = 1 / P[t]`:

```text
realMin[t] = nominalMin[t] * s[t]
realMax[t] = nominalMax[t] * s[t]
realMean[t] = nominalMean[t] * s[t]
realStandardDeviation[t] = nominalStandardDeviation[t] * s[t]
realQuantile[p,t] = nominalQuantile[p,t] * s[t]
```

This transformation is exact in real arithmetic because multiplication by a
positive constant is order-preserving. It must be applied to already-computed
nominal aggregates rather than re-sorting deflated raw paths. This preserves the
current aggregation and random loop and gives one normative IEEE-754 result.

## Relationship between nominal return, inflation, and real return

For a deterministic nominal gross return `1 + r_n` and price growth `1 + i_a`,
the exact annual real growth rate is:

```text
r_real = (1 + r_n) / (1 + i_a) - 1
```

The familiar relation

```text
r_real approximately equals r_n - i_a
```

is a first-order approximation only. MarketSim must use the ratio, never the
subtraction, for calculation.

At a monthly path level:

```text
G_real[t,j] = G[t,j] / F_i
ln(G_real[t,j]) = ln(G[t,j]) - ell_i
```

The volatility of log real returns equals the volatility of nominal log returns
because `ell_i` is deterministic. M6 should simulate the nominal process first
and then deflate it. Pre-transforming inputs to a real-return process would make
nominal output reconstruction and compatibility harder without adding
information.

For initial capital only, the annual expected real growth factor is exactly:

```text
E[nominal annual gross growth] / annual price growth
= (1 + annualExpectedReturn) / (1 + annualInflation)
```

This statement is conditional on the model's constant parameters and
deterministic price index; it is not a market forecast.

## Contribution semantics

### Fixed nominal contribution — selected for M6

M6 should preserve the only currently implemented contribution meaning:

```text
C[t] = monthlyContribution = C
```

The nominal payment remains the same every month. With positive inflation its
purchasing power declines:

```text
C_real[t] = C / P[t]
```

The real cumulative contribution basis at checkpoint `t` should measure each
cash flow in today's euros at the time it is paid:

```text
D_real[t] = initialCapital + sum(k = 1..t, C / P[k])
```

This differs from `(initialCapital + t*C) / P[t]`, which incorrectly applies the
final checkpoint price level to every historical deposit. The nominal
contribution summary must remain unchanged. A new real contribution summary or
real trajectory reference must use `D_real[t]` explicitly.

The final real investment-growth distribution is:

```text
realInvestmentGrowth[j] = R[M,j] - D_real[M]
```

Since `D_real[M]` is deterministic, its aggregate statistics are the real final
balance statistics shifted by `-D_real[M]`; standard deviation is unchanged.

For `F_i != 1`, the real periodic contribution total has the reference form:

```text
sum(k = 1..M, C / F_i^k) = C * (1 - F_i^(-M)) / (F_i - 1)
```

For `F_i = 1`, it is `M*C`.

### Inflation-indexed contribution — deferred

An indexed contribution changes nominal cash flows and therefore changes
nominal balances; it is not merely a display transformation. Supporting both
modes in M6 would add a new product decision and compatibility surface without
being required to explain real values. M6 should not add a contribution-mode
field and should support fixed nominal contributions only.

A future milestone may define `monthlyContribution` as the first month-end
nominal payment and then use:

```text
C_indexed[1] = monthlyContribution
C_indexed[t] = monthlyContribution * F_i^(t - 1)
```

Under that convention the first payment is exactly the entered amount and later
payments rise or fall with inflation. Choosing instead a constant amount in
today's euros would use `C[t] = C_today * P[t]` and would make the first nominal
payment different from the input. That alternative must not be introduced
without an explicit future contract and model-version decision.

## Monthly event order

For each month `t` and path `j`, the proposed M6 order is:

1. Read the prior nominal month-end balance `B[t-1,j]`.
2. If nominal volatility is non-zero, consume exactly one standard-normal value
   in the existing month-major order and compute `G[t,j]`.
3. Apply nominal market growth to the prior balance.
4. Add the fixed nominal contribution `C` at the end of the month, producing
   `B[t,j]`.
5. Establish the completed-month price index `P[t]` from the deterministic
   closed form.
6. Aggregate nominal balances exactly as today.
7. Derive real balance aggregates by the positive scale `1/P[t]`, and update the
   deterministic real contribution basis.

Equivalently, the real path recurrence is:

```text
R[0,j] = initialCapital
R[t,j] = R[t-1,j] * G[t,j] / F_i + C / P[t]
```

The contribution is deflated at the end-of-month price level because it is paid
at that checkpoint. Inflation never changes when the contribution enters the
nominal balance.

## Implemented result contract

M6 preserves every existing nominal result field and its meaning. In
particular, existing `finalValueStatistics`, `investmentGrowthStatistics`,
`contributions`, and `trajectory` must remain nominal rather than being silently
reinterpreted.

Result schema 3 adds `realValues`, an explicitly named section containing:

- the effective annual and derived monthly inflation assumptions;
- the terminal price index;
- real final-value statistics;
- real investment-growth statistics;
- the real contribution basis;
- a real monthly trajectory with month, price index, real contributed basis,
  mean, and the existing seven percentile keys.

The implemented `RealValueResult` contains `contributions`,
`finalValueStatistics`, `investmentGrowthStatistics`, and `trajectory`. Each
`RealAggregatedTrajectoryPoint` adds `priceIndex`; the effective annual
inflation remains in `SimulationResult.config`. Monthly inflation parameters
and the terminal index are not duplicated because they are deterministically
derivable from the configuration and trajectory.

Raw paths remain excluded. At each month, a parallel real trajectory point is
derived from the nominal point; the fundamental monthly trajectory resolution
and percentile structure do not change.

## Fan-chart semantics

The alternatives are:

1. a nominal fan chart plus a separate real indicator, which hides how
   purchasing power changes throughout the horizon;
2. a real-only main chart, which communicates purchasing power but removes
   direct access to the nominal contract;
3. one chart with a nominal/real view switch, which preserves both meanings
   without overlaying two sets of bands.

M6 should use option 3: one simple, accessible nominal/real switch and never two
overlaid fans. When non-zero inflation is enabled, the real view should be the
default because it answers the educational purchasing-power question; the
nominal view remains available for auditability. Each view must label its unit
explicitly. The real view must use `D_real[t]` for its contribution reference.

Both views preserve P5-P95, P10-P90, P25-P75, and P50. Deterministic deflation
changes the level and time profile but does not invent a new uncertainty band.
The UI must state that inflation is a fixed assumption and is not included as a
source of uncertainty.

## RNG and reproducibility

Deterministic inflation requires no random source. M6 must:

- keep xoshiro128** 1.1 unchanged;
- keep midpoint uint32-to-uniform conversion unchanged;
- keep Box-Muller and its cache unchanged;
- keep month-major normal consumption unchanged;
- consume no normal values for inflation;
- preserve zero-volatility behavior with no random calls;
- retain the same randomness-algorithm identifier.

For the new supported contract:

```text
same canonical seed
+ same validated nominal configuration
+ same annual inflation
+ same model version
= same complete nominal and real result
```

The nominal projection of a new zero-inflation job must equal the corresponding
legacy result exactly. Old supported jobs must continue to reproduce their
complete existing results.

## Implemented versioning

Versioning concerns remain separate:

- **Job schema:** introduce schema version 2 because a new job/configuration
  shape requires `annualInflation`.
- **Mathematical model:** keep `monthly-lognormal-v1` supported and unchanged for
  legacy jobs. Introduce `monthly-lognormal-inflation-v1` for the complete model
  that adds the deterministic price index, real contribution basis, and real
  outputs. The nominal return submodel is unchanged, but the full result
  semantics are new enough that reusing the old model identifier would be
  misleading.
- **Result schema:** introduce schema version 3 because the serialized result
  gains explicit inflation and real-value structures. This is the existing
  `SimulationResult.schemaVersion` concern, not a fourth version axis.
- **Randomness algorithm:** retain
  `xoshiro128ss-1.1-box-muller-v1` and pin it to the new model as well.

The implementation uses a version-discriminated legacy/new job and result
contract. A schema-1 job is never silently reinterpreted as though it contained
inflation. An explicit migration to schema 2 may inject
`annualInflation = 0`, after which its nominal projection must remain identical.

## Validation and numerical limits

The implementation requires `annualInflation` to be a finite
decimal fraction in the inclusive range:

```text
-0.5 <= annualInflation <= 1.0
```

This deliberately permits substantial deflation and inflation while excluding
the singular neighborhood of -100% and unsupported hyperinflation inputs. At
the existing maximum 1,200-month horizon, this bound keeps the deterministic
price index between `2^-100` and `2^100`, safely positive and finite before it
is combined with portfolio results. It is a supported-model limit, not a claim
that values outside it are economically impossible.

Every derived `ell_i`, `F_i`, `i_m`, `P[t]`, reciprocal scale, real statistic,
and real contribution total must still be checked for finiteness. A zero or
non-finite price index and a non-finite derived result must raise an explicit
numerical error; the implementation must not clamp, return corrupted output, or
silently fall back to nominal values.

Negative inflation within the bound is allowed. `annualInflation = -1` and
values near it but below the supported floor are rejected at validation, before
randomness is consumed.

## Mandatory implementation tests

### Conversion and price-index tests

1. `annualInflation = 0` produces `ell_i = 0`, `i_m = 0`, and `P[t] = 1`.
2. For positive and negative supported values,
   `(1 + i_m)^12` matches `1 + i_a` within documented floating tolerance.
3. `P[0] = 1`, `P[1] = F_i`, and `P[12] = 1 + i_a` within tolerance.
4. Non-finite and out-of-range annual inflation is rejected before any random
   call.

### Required economic cases

5. **Zero inflation:** every real balance statistic and trajectory percentile
   equals its nominal counterpart; real and nominal contribution bases match.
6. **Zero return and zero contribution:** with positive inflation, nominal
   initial capital stays constant and real value follows
   `initialCapital / P[t]`, decreasing at every checkpoint.
7. **Initial capital only:** with zero volatility,
   `B[t] = initialCapital * g^t` and
   `R[t] = initialCapital * (g/F_i)^t`, where
   `g = (1 + annualExpectedReturn)^(1/12)`.
8. **Fixed nominal contribution:** the nominal recurrence adds exactly the same
   `C` at every month end; at zero return,
   `B[t] = initialCapital + t*C`, while
   `R[t] = B[t]/P[t]` and
   `D_real[t] = initialCapital + sum(C/P[k])`.
9. **Known stochastic path:** controlled normal values reproduce the existing
   nominal recurrence exactly, and every real aggregate equals its nominal
   aggregate divided by the known `P[t]`.
10. **Nominal/real comparison:** verify the exact gross-rate relation
    `(1+r_n)/(1+i_a)-1`; do not assert the subtraction approximation.
11. **Negative inflation:** a supported negative rate makes `P[t]` decrease and
    the real value of a positive nominal balance exceed its nominal value after
    month 0.

### Reproducibility and compatibility tests

12. The same new-version job and seed produce a structurally identical complete
    result, including every nominal and real checkpoint.
13. Different seeds still produce different nominal and real stochastic
    trajectories.
14. Inflation adds zero RNG calls: with non-zero volatility there remain exactly
    `M*N` normal requests in month-major order; with zero volatility there are
    none.
15. Existing schema-1/model-v1 golden and full-result tests remain unchanged.
16. An explicit legacy-to-new migration with zero inflation has a nominal
    projection exactly equal to the legacy result.
17. JSON serialization and reload preserve the inflation assumption, versions,
    seed, and complete result reproducibility.

### Aggregation and numerical tests

18. Positive scaling by `1/P[t]` preserves percentile ordering and divides mean,
    min, max, median, population standard deviation, and all Type 7 percentiles
    by the same price index.
19. Real investment-growth statistics use the real contribution basis and
    preserve the real final-value standard deviation under the deterministic
    shift.
20. Test both validation bounds, just-inside values, just-outside values,
    non-finite values, 1,200 months, high supported inflation, and high supported
    deflation.
21. Force or construct non-finite derived values and verify an explicit
    numerical error rather than `NaN`, infinity, clamping, or partial output.
22. Verify month 0, one month, 12 months, and the final month to catch off-by-one
    errors in the price-index and contribution timing.

Timing and equality assertions should use exact equality where the normative
operations are identical and explicit tolerances only where transcendental
floating-point calculations make them necessary.

## Theoretical reference formulas

For constant effective annual inflation `i_a`, monthly factor `F_i`, expected
nominal monthly gross growth `g`, fixed nominal contribution `C`, and `M`
months:

```text
P[M] = F_i^M = (1 + i_a)^(M/12)

E[B[M]] = initialCapital * g^M
          + C * (g^M - 1) / (g - 1),  when g != 1

E[B[M]] = initialCapital + M*C,         when g = 1

E[R[M]] = E[B[M]] / P[M]

D_real[M] = initialCapital
            + C * (1 - F_i^(-M)) / (F_i - 1),  when F_i != 1

D_real[M] = initialCapital + M*C,               when F_i = 1
```

These formulas are mandatory independent references for future deterministic
and convergence tests; tests must not merely duplicate the implementation loop.

## M6 implementation decision summary

- Inflation model: deterministic effective annual assumption.
- Annual-to-monthly conversion: geometric compounding using `log1p`/`expm1`.
- Price index: `P[0]=1`, `P[t]=(1+annualInflation)^(t/12)`.
- Real value: nominal balance or aggregate divided by positive `P[t]`.
- Return process: simulate nominal returns first, then deflate.
- Volatility: existing annualized nominal log-return volatility, unchanged.
- Contributions: fixed nominal end-of-month amount only in M6.
- Real contribution basis: deflate each cash flow at its own payment checkpoint.
- Indexed contributions: explicitly deferred to a separately versioned future
  decision.
- Output: preserve existing nominal fields and add explicit parallel real
  results; do not reinterpret the current trajectory.
- Fan chart: one nominal/real switch, real default for non-zero inflation, no
  dual overlay.
- RNG: no additional source or consumption; algorithm and ordering unchanged.
- Versioning: job schema 2, result schema 3, new
  `monthly-lognormal-inflation-v1`, existing randomness algorithm.
- Validation: finite annual inflation from -50% through +100%, plus finite
  derived-value guards.
- Compatibility: legacy schema/model remains supported and exactly
  reproducible; zero-inflation migration preserves its nominal projection.
