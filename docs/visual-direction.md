# MarketSim visual direction

Status: accepted direction, implemented and re-verified through Milestone 5.

## Design premise

MarketSim should feel like a quiet quantitative instrument: exact enough for an
analyst, legible enough for a curious first-time investor, and calm enough to
keep uncertainty from becoming spectacle.

The visual idea is **structured uncertainty**. Stable elements—assumptions,
labels, axes, and contributed capital—use a restrained neutral system. Variable
outcomes expand into nested percentile bands. The fan chart is therefore the
main identity-bearing element, not a decorative chart placed inside a generic
dashboard.

This direction rejects generic dashboard grids, excessive cards, decorative
gradients, ambient glass effects, arbitrary accent colors, ornamental metrics,
and unmodified component-library aesthetics.

## Reference screen

The first representative screen establishes the composition used by later
features:

1. **Assumptions** form a compact control rail with explicit units and concise
   educational context.
2. **Simulation action** is one strong action at the end of the input flow.
3. **Main uncertainty visualization** receives the largest continuous area and
   communicates multiple possible trajectories through nested bands.
4. **Key results** form a calm, aligned reading strip beneath the chart rather
   than a collection of unrelated statistic cards.

Milestone 4 connects this composition to the real engine. Displayed output must
now come from a completed `SimulationResult`; idle and running states show no
placeholder statistics or invented chart geometry.

## Typography

Use platform-local fonts so the app remains offline and introduces no font
tracking or flash of remote content.

```text
Sans: "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif
Mono: "Cascadia Code", "SFMono-Regular", Consolas, ui-monospace, monospace
```

- Product name and major headings use the sans family at 600-650 weight, tight
  but not compressed tracking, and compact line height.
- Body copy uses 400-450 weight and a generous 1.5-1.65 line height.
- Eyebrows and axis labels use uppercase sparingly, 11-12 px size, and wider
  tracking to describe structure—not to decorate every region.
- Money, percentages, seed values, and table data use tabular numerals. Mono is
  reserved for small technical metadata, not long prose.
- The fluid display scale uses `clamp()`; body and control text never shrink
  below 16 px on mobile inputs.

Planned semantic scale:

| Token            | Range           | Use                            |
| ---------------- | --------------- | ------------------------------ |
| `--type-display` | 2.25-4.5rem     | one product statement per view |
| `--type-title`   | 1.5-2rem        | workspace and chart titles     |
| `--type-heading` | 1.0625-1.25rem  | section headings               |
| `--type-body`    | 1rem            | controls and explanatory copy  |
| `--type-small`   | 0.8125-0.875rem | metadata and notes             |
| `--type-label`   | 0.6875rem       | structural eyebrows and axes   |

## Spacing system

Use a 4 px base grid with a deliberately small token set:

```text
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 24px
--space-6: 32px
--space-7: 48px
--space-8: 64px
--space-9: 96px
```

Dense numerical groups may use 8-12 px gaps. Major regions use 32-64 px gaps.
Whitespace establishes hierarchy before borders or containers are added.

## Color system

Color roles are semantic and theme-independent. Components consume role tokens,
never raw palette values.

### Light theme

| Role          | Value     | Intent                             |
| ------------- | --------- | ---------------------------------- |
| Canvas        | `#f2f4f0` | quiet mineral background           |
| Surface       | `#fafbf8` | working plane                      |
| Elevated      | `#ffffff` | menus and focused overlays only    |
| Ink           | `#14201c` | primary text and axes              |
| Muted ink     | `#5b6862` | supporting explanation             |
| Faint ink     | `#64716b` | quiet metadata with AA contrast    |
| Border        | `#d7ddd8` | structural separation              |
| Strong border | `#aeb9b3` | active divisions and control edges |
| Accent        | `#08705c` | primary action and selected state  |
| Accent hover  | `#075b4c` | action hover                       |
| Focus         | `#167eeb` | unmistakable keyboard focus        |
| Warning       | `#a6532b` | assumptions or downside context    |

### Dark theme

| Role          | Value     | Intent                             |
| ------------- | --------- | ---------------------------------- |
| Canvas        | `#0c1412` | deep neutral-green field           |
| Surface       | `#111d19` | working plane                      |
| Elevated      | `#182722` | menus and focused overlays only    |
| Ink           | `#eff4f1` | primary text and axes              |
| Muted ink     | `#a9b6b0` | supporting explanation             |
| Faint ink     | `#829089` | metadata with accessible sizing    |
| Border        | `#2b3c36` | structural separation              |
| Strong border | `#52655e` | active divisions and control edges |
| Accent        | `#65d6b7` | primary action and selected state  |
| Accent hover  | `#86e4c9` | action hover                       |
| Focus         | `#6eb7ff` | unmistakable keyboard focus        |
| Warning       | `#f0a06f` | assumptions or downside context    |

Accent green represents user agency and the selected model, not “profit.” Loss,
downside, and uncertainty are never communicated by color alone.

## Surface and background hierarchy

- Canvas is the environmental background.
- One continuous surface defines the simulation workspace.
- Internal regions are separated primarily by alignment, spacing, and single
  borders—not by nesting cards inside cards.
- Elevated surfaces are limited to temporary menus, popovers, and dialogs.
- A subtle technical grid may appear only behind data visualization, using a
  low-contrast line token; it must not cover the whole product.

## Borders, radii, and shadows

- Standard borders are 1 px; a 2 px accent edge can identify active regions.
- Radii are compact: 4 px for small controls, 8 px for inputs/buttons, and 12 px
  for the main workspace. Circular or pill shapes are reserved for icon buttons,
  compact statuses, and segmented controls where the geometry has meaning.
- The base interface uses no ambient shadow. Elevated overlays use one neutral,
  theme-aware shadow. Focus is expressed by a high-contrast outline, not shadow.

## Buttons

- One primary action per decision area, filled with the accent role.
- Secondary actions use a border or quiet text treatment.
- Minimum height is 44 px; labels start with specific verbs.
- Loading preserves width, communicates progress textually, and prevents repeat
  submission. Disabled controls retain readable labels and explain why the
  action is unavailable.
- Hover, active, focus-visible, disabled, and busy states are all designed; no
  state relies solely on opacity.

## Inputs

- Labels remain visible above values. Placeholder text is never the only label.
- Units sit in a stable trailing slot so numeric values align vertically.
- Helper or error text occupies predictable space where layout stability matters.
- Focus uses the focus token plus a strong border; invalid state includes icon or
  text and an announced error, not just red color.
- Numeric controls use tabular numerals and 16 px minimum text on mobile.

## Navigation

Navigation is a slim product rail, not a dashboard sidebar. The wordmark and fan
symbol anchor the left edge; a small number of text destinations, local-only
status, and theme control occupy the right. Mobile collapses secondary links but
keeps product identity and theme access visible.

## Data visualization language

Visualization is a first-class explanatory layer:

- Outcome ranges use nested, flat-color percentile bands: P5-P95 is quietest,
  P25-P75 is stronger, and the P50 line is crisp and directly labeled.
- No decorative gradient is used. Opacity, line weight, texture/dash, direct
  labels, and surrounding text provide redundant encodings.
- Contribution is a thin neutral reference line. It must not compete with the
  uncertainty bands.
- Grid lines are sparse; axes use plain-language time and compact currency.
- Tooltips supplement rather than contain essential information.
- Every chart has a textual summary and a table or equivalent accessible data
  representation when it displays real simulation output.
- Motion, when enabled, reveals the horizon from left to right once; bands do
  not pulse, float, or loop.

The fan chart silhouette—one narrow origin opening into nested probability
ranges—is also the basis of the product mark. This makes the chart language and
brand language the same system.

### Quantitative interaction implemented in Milestone 5

- P5-P95, P10-P90, and P25-P75 remain flat nested bands; P50 and contributed
  capital remain distinct lines. Geometry comes directly from every monthly
  aggregate with no visual smoothing that could imply uncomputed values.
- Time ticks adapt to the actual horizon. Verified examples use 3-month ticks
  over one year, 3-year ticks over 15 years, and 10-year ticks over 40 years.
  Currency ticks share one readable compact scale in both themes.
- Pointer movement or contact selects the nearest real month and moves one
  crosshair. A persistent panel reports all seven percentile values, so detail
  is not hidden in a transient hover tooltip.
- A 44 px native range control exposes the same month selection to touch and
  keyboard users. Home/End, arrows, and Page Up/Down have explicit behavior and
  a human-readable `aria-valuetext`.
- Accessible text names duration, final median, and final P5-P95 range. A
  collapsible table uses the adaptive time checkpoints to explain the essential
  trend without dumping every monthly observation.
- At phone width the chart stays visible as the identity-bearing overview while
  the inspector becomes a two-column reading surface. The table owns its
  horizontal scroll; the page itself does not overflow.

Browser verification covers 1440x1000, 820x1000, and 390x844 in both light and
dark themes. The implementation preserves the continuous workspace surface,
restrained palette, direct labels, visible focus, reduced-motion rule, and
44 px-class controls; it introduces no gradients, chart library, or decorative
statistics.

## Information hierarchy

The reading order is:

```text
Context and model status
  -> assumptions
  -> run action
  -> uncertainty range
  -> median in context
  -> contributions and investment growth
  -> model explanation and disclaimer
```

The largest number is not automatically the most important element. The range
and its interpretation outrank a single median. Technical metadata such as seed
and model version is visible but quiet.

## Interaction states

- Hover confirms clickability without moving layout.
- Active states use a small scale or tone change only where it improves feedback.
- Focus-visible is a 2 px high-contrast outline with at least 2 px offset.
- Selected states combine color with shape, label, or border.
- Errors appear near the source and in a summary for multi-field failures.
- Empty states explain the next action. Loading and cancellation keep prior valid
  results visible when safe. Stale results are labeled rather than silently mixed
  with changed assumptions.

## Motion principles

- Motion explains causality, progress, and state change; it does not decorate.
- Control transitions use approximately 120-180 ms. Large chart transitions may
  use 220-320 ms with restrained easing.
- No infinite motion, parallax, ambient shimmer, or autonomous layout movement.
- `prefers-reduced-motion: reduce` removes nonessential transitions and renders
  chart/result states immediately.

## Responsive composition

- Wide screens use an assumptions rail beside a dominant chart workspace, with
  key results as an aligned strip.
- Tablets preserve chart width and move results below it before shrinking the
  visualization.
- Phones use a deliberate vertical narrative: context, assumptions, action,
  chart, results, explanation. Controls remain 44 px-class and respect safe-area
  insets.
- Breakpoints follow content failure points, initially near 720 px and 1080 px;
  browser verification may refine them and must record why.

## Foundation acceptance criteria

- Tokens cover every system described above in both light and dark themes.
- The reference screen contains assumptions, action, uncertainty visualization,
  and key results without excessive card framing.
- The chart reads as the visual focus at desktop and mobile sizes.
- Keyboard focus, semantic structure, 44 px-class controls, reduced motion, and
  theme selection work in the implemented foundation.
- Result values and fan-chart geometry are absent before a successful run and
  are derived only from the real engine afterward.
- Visual verification covers light/dark and phone/desktop layouts.
