# Simulation model

Status: the domain contracts, validation, monthly lognormal model, path
evolution, aggregation, percentiles, final-value statistics, seeded generator,
and reproducibility contract described here are implemented and tested through
Milestone 6, including deterministic inflation, parallel real values, legacy
compatibility, expected-value convergence, and optimization-equivalence checks.

## Purpose and interpretation

The model samples many outcomes conditional on user-supplied assumptions. It is
not calibrated market data, a forecast, a guarantee, or financial advice.
Percentiles describe only the generated sample under the selected model and
inputs.

> MarketSim is an educational simulation tool. It does not predict future
> market returns and does not constitute financial advice.

## Public contracts

`SimulationConfig` uses explicit units:

| Field                  | Meaning                                               | Valid range                 |
| ---------------------- | ----------------------------------------------------- | --------------------------- |
| `initialCapital`       | Nominal money invested at month 0                     | 0 to 1,000,000,000,000      |
| `monthlyContribution`  | Fixed nominal amount added at each month end          | 0 to 1,000,000,000          |
| `durationMonths`       | Number of complete monthly periods                    | integer, 1 to 1,200         |
| `annualExpectedReturn` | Effective annual expected simple return, decimal form | greater than -1, at most 10 |
| `annualVolatility`     | Annualized standard deviation of log returns, decimal | 0 to 5                      |
| `annualInflation`      | Deterministic effective annual price-level change     | -0.5 to 1.0                 |
| `simulationCount`      | Number of paths                                       | integer, 1 to 100,000       |

For rate fields, `0.07` means 7%; `7` does not mean 7%. The engine accepts
duration in months and does not silently convert fractional years.

Validation reports all detected field issues as stable field/code/message/value
objects. Non-finite values, invalid integers, negative money amounts, an annual
return at or below -100%, and values beyond the documented computational limits
are rejected before randomness is consumed.

`SimulationResult` contains:

- `schemaVersion`, `modelVersion`, and `randomnessAlgorithm`;
- the canonical seed that generated the run;
- the validated immutable configuration;
- initial, periodic, and total contribution amounts;
- final portfolio-value statistics;
- investment-growth statistics after subtracting total contributions;
- an aggregated point for month 0 and every completed month.
- a parallel `realValues` section with real contribution, final-value,
  investment-growth, and price-indexed monthly trajectory data.

Raw paths are intentionally not returned.

`SimulationJob` is the serializable execution boundary. It contains its schema
version, the mathematical model version, the 128-bit seed, and
`SimulationConfig`. The seed is execution metadata rather than a financial
assumption, so it is not embedded in `SimulationConfig`.

## Versioning

The current job uses `schemaVersion = 2`, the result uses `schemaVersion = 3`,
and the full model is `modelVersion = "monthly-lognormal-inflation-v1"`. Legacy
job schema 1/result schema 2 with `monthly-lognormal-v1` remains supported and
is not reinterpreted. Both models use
`randomnessAlgorithm = "xoshiro128ss-1.1-box-muller-v1"`.

Schema shape, mathematical model, and randomness implementation are separate
compatibility concerns. Reproducibility is scoped to the same supported model,
randomness algorithm, canonical seed, validated configuration, simulation
count, sample-consumption order, and IEEE-754 execution contract.
For a supported `modelVersion`, the engine pins exactly one
`randomnessAlgorithm`; changing that mapping requires a new model version. The
result records the resolved algorithm explicitly for auditability.

## Time step and order of operations

The base time step is one month. Initial capital is the balance at month 0. For
each path and month `t`:

1. read the previous month-end balance `B[t-1]`;
2. obtain that month's standard-normal innovation when volatility is non-zero;
3. calculate and apply the gross monthly growth factor `G[t]`;
4. add the fixed nominal contribution `C` at the end of the month;
5. aggregate balances for the completed month.

The recurrence is:

```text
B[0] = initialCapital
B[t] = B[t-1] * G[t] + monthlyContribution
```

The contribution therefore earns no return in the month in which it is paid.

## Deterministic inflation and real values

`annualInflation = i_a` is an effective annual deterministic price-level
change. The engine converts it geometrically, not by dividing the rate by 12:

```text
ell_i = log1p(i_a) / 12
F_i = exp(ell_i)
i_m = expm1(ell_i)
P[0] = 1
P[t] = exp(t * ell_i) = (1 + i_a)^(t/12)
```

The nominal simulation, random consumption, aggregation order, Welford
statistics, and Type 7 percentiles execute unchanged. At each checkpoint the
engine derives the real aggregate with the positive scale `1/P[t]`; min, max,
mean, standard deviation, median, and every percentile are scaled without a
second simulation or sort.

Nominal contributions remain fixed and arrive at month end. Their real
cumulative basis deflates each payment at its own checkpoint:

```text
D_real[0] = initialCapital
D_real[t] = initialCapital + sum(k=1..t, monthlyContribution / P[k])
```

It is intentionally not `(initialCapital + t*C) / P[t]`. Real investment
growth shifts the terminal real-value distribution by `-D_real[M]`. Complete
semantics, numerical guards, and theoretical references are normative in
`docs/inflation-model.md`.
Changing to beginning-of-month contributions would change the model and must
never be implemented as an undocumented loop reorder.

## Annual-to-monthly conversion

Let:

- `r` be the effective annual expected simple return;
- `sigmaAnnual` be annualized log-return volatility;
- `Z[t]` be an independent standard-normal innovation.

For `r > -1`:

```text
sigmaMonthly = sigmaAnnual / sqrt(12)
logDriftMonthly = ln(1 + r) / 12 - 0.5 * sigmaMonthly^2
G[t] = exp(logDriftMonthly + sigmaMonthly * Z[t])
```

The `-0.5 * sigmaMonthly^2` correction converts from an expected arithmetic
growth factor to the mean of the lognormal exponent. Consequently:

```text
E[G[t]] = (1 + r)^(1 / 12)
E[product(G[1..12])] = 1 + r
```

under the independent, constant-parameter assumptions. Volatility follows the
square-root-of-time convention. It is explicitly log-return volatility; the
engine does not reinterpret it as the standard deviation of annual simple
returns.

Gross factors are positive, so an invested balance cannot become negative from
returns alone. The model deliberately omits fat tails, autocorrelation,
time-varying regimes, and uncertainty in the return/volatility assumptions.

At zero volatility no random value is requested. Every path uses the
deterministic factor `(1 + r)^(1/12)`. At zero return and zero volatility the
closed form is:

```text
B[M] = initialCapital + M * monthlyContribution
```

subject only to binary floating-point tolerance.

## Seed representation

`SimulationSeed` is a JSON-safe string of exactly 32 hexadecimal digits. It
encodes four consecutive 32-bit state words in textual big-endian order:

```text
0123456789abcdeffedcba9876543210
|------||------||------||------|
   s0      s1      s2      s3
```

Uppercase input is accepted and normalized to lowercase. Short, long,
non-hexadecimal, non-string, and all-zero seeds are rejected. The all-zero
state is invalid for xoshiro128**. A string avoids loss of precision that would
occur if a 128-bit value were stored in a JavaScript `number`, and it survives
JSON serialization exactly.

The engine never invents a seed. `simulate(job)` requires an explicit valid
seed; there is no clock-, crypto-, or `Math.random()`-based fallback.

## Uniform PRNG: xoshiro128** 1.1

MarketSim uses the 32-bit `xoshiro128**` version 1.1 generator by David Blackman
and Sebastiano Vigna. It was selected because its four-word state maps naturally
to JavaScript bitwise operations, it is fast, dependency-free, has period
`2^128 - 1`, and uses no browser-specific API. It is suitable for Monte Carlo
sampling but is not cryptographically secure.

The implementation follows the authors' [xoshiro128** 1.1 reference
implementation](https://prng.di.unimi.it/xoshiro128starstar.c), including use of
`s1` in the output scrambler.

For state `(s0, s1, s2, s3)`, each call returns the low 32 bits of:

```text
result = rotl(s1 * 5, 7) * 9
t = s1 << 9

s2 ^= s0
s3 ^= s1
s1 ^= s2
s0 ^= s3
s2 ^= t
s3 = rotl(s3, 11)
```

Every multiplication uses `Math.imul`, every shift is a 32-bit bitwise
operation, and every state/output word is normalized with unsigned `>>> 0`.
Committed uint32 vectors prevent a state-word, scrambler, rotation, or overflow
change from going unnoticed.

## Uniform-to-normal transform

Each uint32 word `w` is mapped to the midpoint of one of `2^32` equal bins:

```text
u = (w + 0.5) / 2^32
```

This guarantees `0 < u < 1`; neither endpoint can reach the logarithm in the
normal transform. For two consecutive uniform values `u1` and `u2`, the
standard Box-Muller equations are:

```text
radius = sqrt(-2 * ln(u1))
angle = 2 * pi * u2
z0 = radius * cos(angle)
z1 = radius * sin(angle)
```

`z0` is returned immediately and `z1` is cached for the next call, so every two
normal values consume exactly two uint32 words. The cache ordering is part of
the randomness algorithm version and has a committed vector.

Midpoint mapping keeps both values finite even for uint32 endpoints. With a
32-bit uniform source, the largest possible Box-Muller radius is approximately
`6.763705635`; this is an explicit finite-resolution tail limit rather than an
overflow or rejection artifact.

## Randomness boundary and consumption order

`Xoshiro128StarStar` implements `Uint32RandomSource`.
`BoxMullerNormalSource` converts that interface into the existing
`NormalRandomSource`, and `SeededNormalRandomSource` composes the production
pipeline. These small interfaces preserve direct controlled-source testing of
the mathematical loop.

For non-zero volatility the consumption order is fixed and month-major:

```text
month 1: path 0, path 1, ... path N-1
month 2: path 0, path 1, ... path N-1
...
```

This ordering is tested with both controlled sources and the seeded production
source. Zero volatility consumes no normal values. Changing the path order,
Box-Muller cache order, uniform mapping, or PRNG transition is a reproducibility
change and requires a compatibility/version decision.

## Reproducibility guarantee

Within the supported engine/model/randomness contract:

```text
same canonical seed
+ same validated configuration
+ same model version
= same complete SimulationResult
```

This includes every trajectory point, percentile, and final statistic. The
guarantee is demonstrated by full structural-equality tests and by serializing
a `SimulationJob` to JSON, reloading it, and reproducing the same result.
Different valid seeds produce different uint32/normal sequences and different
stochastic trajectories.

The PRNG transition is bit-stable across conforming JavaScript runtimes because
it uses explicit uint32 operations. Box-Muller depends on the runtime's
IEEE-754 transcendental functions; exact cross-engine equality is not claimed
until the project runs committed vectors on every supported WebView family.

## Contributions and investment growth

For constant contribution `C` and `M` months:

```text
periodicContributions = M * C
totalContributions = initialCapital + periodicContributions
investmentGrowth = finalPortfolioValue - totalContributions
```

Investment growth may be negative. Because the subtracted contribution total is
constant across paths, its distribution has all location statistics and
percentiles shifted by that amount while standard deviation is unchanged.

## Aggregation and sample statistics

At month 0 and after every monthly step, the engine aggregates all current path
balances. This produces exact monthly fan-chart inputs without exposing mutable
or raw path arrays.

For outcomes `x[0..n-1]`, the result reports min, max, mean, median, population
standard deviation, and P5, P10, P25, P50, P75, P90, and P95:

```text
mean = sum(x) / n
populationVariance = sum((x - mean)^2) / n
standardDeviation = sqrt(populationVariance)
```

The denominator is `n`, not `n - 1`, because the function summarizes the full
set of generated paths rather than estimating dispersion from a subsample.
Mean and variance use Welford's online update to reduce cancellation error.

Percentiles use the R-7 / Hyndman and Fan Type 7 interpolation convention. For
sorted zero-indexed values and probability `p`:

```text
h = (n - 1) * p
lower = floor(h)
upper = ceil(h)
weight = h - lower
q(p) = x[lower] * (1 - weight) + x[upper] * weight
```

This works for a single simulation, makes P50 the median, and preserves
percentile ordering. Input arrays are copied into a `Float64Array` before its
ascending numeric sort. Milestone 5 introduced this packed temporary copy only
after profiling; a regression test demonstrates exact equality with the prior
`number[]` copy/sort for the complete statistics object. The percentile
definition, Welford order, monthly aggregation frequency, and public result do
not change.

Connecting monthly P50 values in a fan chart does not describe one realizable
path and must not be labeled as a forecast. The Milestone 5 UI renders the
monthly aggregated percentiles as nested bands, a P50 line, a contribution
reference, a seven-percentile inspector, and an adaptive accessible checkpoint
table; it never labels these values as a forecast. Chart selection always snaps
to a real monthly aggregate and never interpolates a financial value.

## Expected-value convergence check

Milestone 4 adds a quantitative Monte Carlo check against the expectation of
this exact end-of-month-contribution model. Let
`g = (1 + annualExpectedReturn)^(1/12)`. Independence and the drift correction
above give `E[G[t]] = g`, so after `M` months:

```text
E[B[M]] = initialCapital * g^M
          + monthlyContribution * (g^M - 1) / (g - 1),  when g != 1

E[B[M]] = initialCapital + M * monthlyContribution,     when g = 1
```

The empirical estimator is the arithmetic mean of the final balances already
reported by `SimulationResult`. The committed test uses 100,000 paths, 12
months, initial capital 10,000, monthly contribution 250, annual expected
return 7%, annual log-return volatility 18%, and seed
`3f84d5b5b5470917c85abc61e10e3148`.

For that deterministic sample, the theoretical expectation is
13,795.074286, the empirical mean is 13,783.541711, and the empirical standard
error is 6.966019. The acceptance tolerance is five empirical standard errors
plus a machine-epsilon guard, 34.830094. The observed absolute difference,
11.532576, is within the bound. Five standard errors provide a robust,
non-flaky sanity threshold for a finite Monte Carlo sample while still failing
material drift or contribution-order errors; the test does not demand exact
equality to a theoretical distribution.

## Numerical behavior

Calculations use JavaScript `number` (IEEE-754 binary64). Monthly balances are
held internally in a `Float64Array`, but mutable arrays do not cross the public
boundary. Public result objects and arrays are frozen.

All validated inputs and consumed normal samples must be finite. A non-finite
random sample, balance, or aggregate statistic raises an explicit error rather
than being formatted or returned. Currency rounding belongs to presentation or
export policy and is never applied during compounding.

## Scenario comparison does not alter the model

Milestone 7 runs two ordinary current-version jobs with the same explicit seed,
model version, monthly frequency, and simulation count; duration and every
financial assumption may differ. The shared seed and path count apply common
random numbers at comparable stochastic checkpoints. In particular, if only
duration differs, the shorter nominal and real trajectories are exact prefixes
of the longer trajectories. This reduces sampling variation between scenarios
but does not remove Monte Carlo uncertainty.

The application compares only exact stored monthly aggregates through the
longer horizon. At a month present in both results it calculates each displayed
delta as the aggregate value or quantile `B - A`. This is not a quantile of a
pathwise difference distribution. After either result ends, its values and the
delta are unavailable; the application never interpolates or extrapolates. The
workflow adds no RNG draws, return formula, domain schema, or engine API, and
nominal and real values retain the exact Milestone 6 definitions above.

## Explicitly deferred model scope

Milestone 6 does not implement stochastic inflation, indexed contributions,
fees, taxes, shocks, sequence scenarios, multi-asset portfolios, correlation,
historical bootstrap, or alternative return distributions. Those additions require separately
documented event ordering, validation, model versioning, and tests.

Persistence, PWA behavior, and native shells remain outside the model and are
not implemented through Milestone 6. Worker execution and UI state are
application concerns and do not change these formulas.

## Verification coverage through Milestone 6

Executable tests cover:

- annual-to-monthly conversion and the zero-volatility closed form;
- zero return, zero contribution, initial-capital-only, and
  contribution-only configurations;
- one period, multiple periods, and explicit month-major sample consumption;
- contribution timing and contribution/growth summaries;
- Type 7 interpolation, a single value, percentile ordering, population
  statistics, and numeric overflow rejection;
- invalid and non-finite configuration fields without random consumption;
- rejection of non-finite normal samples;
- identical output from equivalent controlled randomness sources.
- committed xoshiro128** uint32 and Box-Muller normal vectors;
- valid uint32 range and open-interval endpoint mapping;
- seed format, canonicalization, all-zero rejection, and job validation;
- same-seed full-result equality and different-seed divergence;
- JSON job serialization/reload reproducibility;
- a deterministic 200,000-value normal sanity sample with finite values, mean
  near zero, population deviation near one, and observations in both tails;
- explicit errors for invalid random values and numerical overflow.
- 100,000-path convergence toward the exact implemented-model expectation
  within a five-standard-error tolerance;
- same seeded result at the Worker adapter boundary, structured Worker errors,
  and real browser Worker execution without changing engine dependencies.
- exact statistics equality between the pre-optimization numeric-array path and
  the measured typed-array copy/sort path;
- isolated 10k/50k/100k engine and real Worker profiling with fixed model,
  seed, duration, and assumptions; profiling changes no acceptance tolerance.
- geometric inflation conversion and independent closed-form price-index checks;
- zero, positive, negative, boundary, non-finite, and 1,200-month inflation cases;
- payment-by-payment real contribution accumulation and regression protection
  against deflating the entire nominal contribution line at the final index;
- exact nominal equality between legacy and zero-inflation current jobs,
  unchanged RNG request count/order, complete same-seed equality, and
  different-seed divergence;
- real min/max/mean/deviation and all percentile scaling, real investment-growth
  shifting, Worker error serialization, and nominal/real UI selection.
