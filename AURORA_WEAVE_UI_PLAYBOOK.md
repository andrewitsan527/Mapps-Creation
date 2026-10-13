# Aurora Weave — Soft Ice · UI Playbook

**Reference implementation: Grey Purchase (`/grey-purchase`).**
This document is both the record of that redesign and the reusable brief for applying the
same treatment to the next ERP page. Part 3 is written to be pasted into a new prompt.

---

## 1. What was done on Grey Purchase

### 1.1 Files touched

| File | Change | Lines |
|---|---|---|
| `src/app/globals.css` | `--gb-*` tokens + the whole scoped `.gb-*` block | **+873 / −0** |
| `src/components/grey-purchase-desk.tsx` | page + dialog restructure, renames | +111 / −73 |
| `src/components/erp-modal.tsx` | `lockScroll` opt-in prop only | **+14 / −0** |
| `src/components/erp-shell.tsx` | one new header branch for this route | +7 / −3 |
| `src/lib/flow.ts` | nav label `Grey bills` → `Grey Purchase` | +1 / −1 |

Two numbers matter: **globals.css and erp-modal.tsx have zero deletions.** Nothing existing
was removed or rewritten, so no other desk could regress. Every visual rule lives under
`.gb-page` / `.gb-sheet`.

### 1.2 Page shell
- `.gb-page` wrapper: light ice workspace with a lightweight woven texture, bleeding past
  `<main>`'s padding. `.gb-stage` centres content at `min(96%, 110rem)`.
- Dedicated `.gb-app-header` (dark midnight satin) for this route only. The existing
  `.tx-app-header` was **not** reused — it is warm parchment, built for the dark textile
  pages, and would have dragged gold into Soft Ice.
- The page-header card was later **removed entirely**: the app-header crumb already names
  the page, and the register's dark bar became the heading.

### 1.3 Register
Dark satin header, ruled grid lines on every cell, 2.3rem rows, rounded frame, a new Date
column, scroll height 360 → 620px, 28px row actions (36px on touch), and status chips fixed
so **SAVED reads as settled (lagoon)** instead of being the greyest thing on the page.

### 1.4 The GP Entry dialog — the main rebuild
Rebuilt from a scrolling document into a **fixed-height workspace**. Full rationale in §2.3.

### 1.5 Naming
One name everywhere: **Grey Purchase** — nav, crumb, register title, buttons, dialogs,
notices. Previously the same object was called *Grey bills* (nav), *Grey Purchase* (page),
*Grey Bill Register* (panel) and *GP Entry* (dialog).

---

## 2. The systemic problems — these are not Grey-Purchase-specific

Every one of these was found in Grey Purchase and will almost certainly exist on the other
desks, because they share `ui.tsx`, `erp-modal.tsx` and `erp-shell.tsx`.

### 2.1 The viewport contract was never stated

**Design target is 100% browser zoom.** Not 90%, not 110%. The UI must fit at 100% on:

| Class | Viewport | Usable height after browser chrome |
|---|---|---|
| Laptop | 1366 × 768 | ~660px |
| Desktop | 1920 × 1080 | ~925px |

Anything that only works because the user zoomed out is broken. Every page needs an explicit
**vertical px budget**, not "it looks fine on my monitor".

### 2.2 The data starts too far down

Measured on Grey Purchase before the fix: the first data row began at **y≈540 of 925 — 58%
of the viewport.** Over half the screen was chrome. The causes generalise:

| Waste | What it was | Rule |
|---|---|---|
| Duplicate breadcrumb | app header said `PROCURE › Grey bills`, page card repeated `PROCURE / Grey Purchase` | the crumb is the title; don't repeat it |
| Oversized KPI cards | `min-height: 5rem`, 1.45rem values | 3.5rem / 1.2rem is enough |
| Notice as a layout block | pushed the table down ~46px on every save/delete | should be an overlay toast |
| Loose rhythm | `space-y-3` + 1.15rem page padding | 0.5rem gap, 0.7rem padding |

After: first row at **y≈217 (23%)**.

> **Rule: the primary table must begin within the top ~25–30% of the viewport.** Build the
> budget as a px table before writing CSS, and count every block above the data.

### 2.3 Dialogs were scrolling documents, not workspaces

This was the worst defect, and `erp-modal.tsx` is shared, so it will repeat anywhere a desk
opens a data-entry dialog.

**Symptoms observed:** at three item rows the Save button was below the fold; the whole
dialog scrolled; it was `63.75vw` wide (≈239px on a 375px phone); the item grid's columns
jumped sideways while typing; the grid was nested in two competing scroll containers.

**The failure modes, and the fix for each:**

| Symptom | Cause | Fix |
|---|---|---|
| Save scrolls out of reach | action bar lived inside the scrolling body | put it **outside** the scroll area as a sibling |
| Whole dialog scrolls | dialog had no height, only `max-h` | fixed height `min(92vh, 46rem)` |
| Columns reshape while typing | `<table>` with auto layout, no colgroup | `table-layout: fixed` + explicit `<colgroup>` |
| Grid shows < 4 rows | inner `max-h-[11.5rem]` cap | `min-height` = header + 4 rows |
| **Empty hole in the grid, totals pushed off-screen** | grid was `flex: 1 1 auto` — a **greedy grid** eats all slack | `flex: 0 1 auto` + `min-height` + `max-height`; give the slack to a designated tail region |
| Two scrollbars, page moves behind | no body scroll lock | opt-in `lockScroll` prop |
| Unreadable on phone | raw `vw` width at every breakpoint | full-screen sheet at `100dvh`, desktop sizes behind `@media (min-width: 640px)` |

**The region model** — a data-entry dialog is a fixed-height frame of locked regions:

```
frame            fixed height: min(92vh, Nrem)
├── header       shrink-0   — title + tools (Upload etc. belong HERE, not on their own row)
└── body         flex-1 min-h-0 flex-col
    ├── main     flex-1 min-h-0 overflow-y-auto
    │   ├── fields   flex: 0 0 auto
    │   ├── grid     flex: 0 1 auto   min-height = 4 rows, max-height = cap
    │   └── tail     flex: 1 1 auto   ← absorbs all leftover height
    └── footer   shrink-0   — action bar, ALWAYS visible
```

Only the grid scrolls, and only past its row cap. `main` scrolls as a last resort on very
short viewports, but the footer never does.

### 2.4 "Zoom out to fit" is not a solution

If a dialog is too tall, the fix is **real CSS sizing** — smaller control padding, type
scale, tighter gaps, moving single-button rows into the header bar. Never
`transform: scale()` and never `zoom`: they blur text, and a transform creates a
**containing block** that breaks every `position: fixed` descendant.

Space recovered on Grey Purchase without removing a single input or feature:

- Upload row folded into the dialog header: **~60px**
- Compact density (labels 11px, inputs 12px / 0.3rem padding, rows 42 → 36px): **~90px**
- Header padding `px-5 py-2.5` → `px-4 py-2`, main padding and gaps: **~40px**

### 2.5 The containing-block trap

Do **not** put `transform`, `filter`, `backdrop-filter` or `will-change` on any ancestor of
a fixed-position dialog — including a page wrapper, a modal frame, or an *animation* that
animates `transform`. The nested unsaved-changes dialog would start positioning itself
against the modal instead of the viewport.

This is why `.gb-sheet` animates **opacity only** while `.gb-confirm` (no fixed descendants)
keeps a translate. There is a comment in `globals.css` saying so — keep it.

### 2.6 Tables that weren't ruled

`.erp-register` drops the last row's bottom border and the last column's right border, and
leans on the panel frame. That is correct — it keeps the frame a crisp 1px instead of
doubling — but the line colour was too faint to read as a ledger. Fixed by strengthening the
grid colour (`#c9d7e3` → `#b6c8d8`) and the dark header's dividers (8% → 20% white), not by
adding more borders.

### 2.7 Status colours were semantically inverted

`statusBadge()` sent `DRAFT` → amber (loud) and `SAVED` → grey (quiet). The finished state
must never be the quietest thing in the row. Fixed per-page via CSS so `format.ts` and every
other desk stayed untouched.

---

### 2.8 Screenshots are not CSS pixels — check the display scale first

The single most expensive mistake in this redesign. Three separate attempts to size
the register by viewport arithmetic landed wrong because the screenshots were taken on a
display at **150% OS scaling**: a 1843×922 screenshot is a **1229×615 CSS** viewport, not
930px tall. Every `calc(100vh - Nrem)` reserve was tuned against a viewport ~50% larger
than the real one.

**Derive the scale before trusting any measurement.** Pick an element whose CSS height you
declared, measure it in the screenshot, and divide:

> declared row height `2.3rem` = 36.8px · measured in screenshot ≈ 55px · **ratio 1.5**

Then convert every other measurement by that ratio. A useful cross-check: if a fixed-height
box renders exactly N rows, the viewport must be at least `N × row-height + chrome`, which
gives a hard lower bound on the real viewport without opening a browser.

### 2.9 A register is a fixed box, not a growing panel

Letting the panel grow to fit its rows (`flex: 1 1 auto` up the chain) looks like "use the
available height" but it is wrong: with 13 rows the panel grew past the viewport and **the
whole page scrolled**. A register must be a **fixed-height box that scrolls inside itself**,
sized by row count:

```css
--gb-register-rows: 12;
--gb-register-row-h: 2.3rem;
--gb-register-head-h: 1.9rem;
height: min(
  calc(var(--gb-register-head-h) + var(--gb-register-rows) * var(--gb-register-row-h)),
  calc(100vh - 8.5rem)   /* last-resort guard, must NOT be the binding constraint */
);
```

Two traps:

1. **The guard silently wins.** If the viewport reserve is tighter than the row maths, raising
   the row count changes nothing at all and the page looks untouched. Always check which of
   the two terms in the `min()` is binding.
2. **Row height must be deterministic.** The declared row height only holds if the tallest
   cell content is shorter than it. Here the action buttons were `1.75rem` + `0.7rem` padding
   = `2.45rem` against a declared `2.3rem`, so content won and every "show N rows"
   calculation was short. Fixed by trimming the buttons to `1.6rem` and padding to `0.3rem`
   (`2.2rem < 2.3rem`).

### 2.10 Transient messages never occupy layout

Anything that appears and disappears — success, error, extraction feedback — must be a
**toast or a popover**, never a block in the flow. A 46px notice strip pushed the register
down on every save, and an extraction warning box re-aligned the whole entry form.

- Page-level → fixed toast, bottom-right, `z-index` **above the sheet but below the confirm
  dialogs** so it can never cover a decision.
- Control-level → popover absolutely positioned inside a `position: relative` wrapper on the
  control itself.
- Give both a close button **and** a ~5s auto-dismiss (`setTimeout` in an effect with
  `clearTimeout` cleanup, so closing the dialog or re-running the action cancels it).
- **Anchor a popover toward the available space.** Anchored `right: 0` on a control near the
  left edge of a frame, it extended leftward and was sliced by the frame's
  `overflow: hidden`. Anchor `left: 0` when the control sits left of centre.

### 2.11 Never show developer diagnostics to a client

The PDF extractor emitted a per-field log — *"Bill no. was not read. Bill date was not read.
Agent was not read…"* — straight into the entry form, and the staged file was announced by
filename. That is test output. Keep generating it if the logic needs it, but render **one
client-safe sentence** instead ("Could not read this bill. Please enter the details
manually.") and never print a filename.

## 3. The brief for the next page — paste this

> ### Aurora Weave — Soft Ice redesign for `<PAGE>`
>
> Apply the same treatment as `/grey-purchase`. Read
> `AURORA_WEAVE_UI_PLAYBOOK.md` and `globals.css` (the `.gb-*` block) first and reuse that
> system — do not invent new tokens.
>
> **Hard constraints**
> 1. Preserve all behaviour: business rules, validations, calculations, permissions, API
>    calls, stock logic, keyboard handlers, focus-trap hooks
>    (`data-po-tab`, `data-skip-modal-tab`, `data-line-id`), refs and effects. Add wrapper
>    elements, colgroups and class names only.
> 2. **Zero deletions in `globals.css`.** All new rules scoped under a page class
>    (`.<x>-page`). Shared components (`ui.tsx`, `erp-modal.tsx`, `erp-shell.tsx`) may only
>    receive *additive* exports or *opt-in* props — never changed defaults.
> 3. Design for **100% browser zoom**. Must fit 1366×768 and 1920×1080. No `transform:
>    scale`, no `zoom`.
>
> **Phase 1 — audit (no edits).** Report: the vertical px budget above the primary data
> (from a screenshot if available), duplicated chrome, dialog scroll behaviour, table layout
> mode, responsive breakpoints, status-colour semantics, and naming consistency across nav /
> crumb / page / dialog / buttons. Separate *verified from source* from *recommended*.
> Stop and wait for approval.
>
> **Phase 2 — implement, in this order**
> 1. Page scope + workspace texture; add the route to the Aurora header branch in
>    `erp-shell.tsx`.
> 2. **No page-header card.** The app-header crumb is the title. The primary panel's dark
>    bar is the heading and carries the primary action beside the search field.
> 3. KPI cards: put **`aw-metrics`** on the MetricStrip plus `grid-cols-2 lg:grid-cols-4`
>    and nothing else. **Never restyle the cards per page** — see "KPI cards are fixed" below.
> 4. Table: dark satin `thead`, ruled cells in `--gb-grid-strong`, ~2.3rem rows, rounded
>    frame, `table-layout: fixed` + `<colgroup>`, status chips with the settled state most
>    prominent, and a **fixed row-count box** per §2.9 — never a growing panel. Confirm the
>    display scale per §2.8 before trusting any screenshot measurement.
> 5. Dialogs: the §2.3 region model — fixed height, locked header/fields/grid/tail/footer,
>    only the grid scrolls, grid `flex: 0 1 auto` with a 4-row minimum and a row cap,
>    footer outside the scroll area, `lockScroll`, full-screen `100dvh` sheet on mobile.
> 6. Motion: ≤240ms, transform-free on any element with fixed descendants, all inside a
>    `prefers-reduced-motion: reduce` block.
> 7. One name for the module across nav, crumb, page, dialogs and buttons.
>
> **Method.** Apply JSX edits with line-anchored scripts that abort on any anchor mismatch —
> never blind find-and-replace in a 1500-line component. After every pass run
> `npx tsc --noEmit --incremental false` and `npx eslint <files>`, and verify CSS brace
> balance plus colgroup/`<th>`/`<td>` column counts. State plainly that nothing was visually
> verified unless a browser was actually opened.

---

## 4. Token and class contract

Defined in `:root`, consumed only under the page scope.

| Role | Token |
|---|---|
| Workspace | `--gb-workspace` `#eaf0f7`, `--gb-workspace-top`, `--gb-workspace-deep` |
| Midnight satin | `--gb-midnight` `#0f1a26`, `--gb-midnight-lift`, `--gb-midnight-deep` |
| Satin text | `--gb-midnight-ink`, `--gb-midnight-muted`, `--gb-midnight-faint`, `--gb-sheen` |
| Ice glass | `--gb-ice` `#e6f0f8` + `--gb-ice-line` |
| Lagoon glass | `--gb-lagoon` `#e2f1ec` + `--gb-lagoon-line` |
| Warm pearl | `--gb-pearl` `#f7f3e9` + `--gb-pearl-line` |
| Table | `--gb-row`, `--gb-row-alt`, `--gb-grid`, `--gb-grid-strong` `#b6c8d8` |
| Ink | `--gb-ink` `#0c1319`, `--gb-ink-soft` |
| Shape | `--gb-radius` 14px, `--gb-shadow-card`, `--gb-shadow-dark` |

**KPI cards are fixed and shared.** `.aw-metrics` is defined once in `globals.css` and
used by every page. The card box is a **fixed `3.75rem` height**, so a metric carrying a
`hint` line is exactly as tall as one without — that is what makes every page match.
Purchase Order drifted taller than Grey Purchase precisely because it used `min-height`
and two of its metrics had hints. **Tables may differ between pages** (column count and
width); **the KPI cards may not.** Adding a page-scoped override for these cards is a bug.

Card roles: **ice** = counts/neutral · **lagoon** = settled/positive · **pearl** = money and
totals · **midnight satin** = every header surface (app header, panel bar, table `thead`,
dialog header).

**Texture budget.** Woven field = two 1px thread gradients at ≤3.5% alpha over a cool wash;
dark satin = one 165° gradient + `inset 0 1px 0` sheen + a gold hairline. Never
`background-attachment: fixed` (there is an in-repo note at `globals.css:70` that it destroys
scroll performance on Windows GPUs). Below 480px the thread layers are dropped — 2 paint
layers instead of 5.

### Useful cascade fact
`globals.css` is plain, unlayered CSS loaded after `@import "tailwindcss"`. Tailwind v4 puts
utilities in `@layer utilities`, and **unlayered CSS beats layered CSS regardless of
specificity**. So page-scoped plain CSS can restyle existing Tailwind-classed markup with no
`!important` and no JSX churn. This is what kept the Grey Purchase JSX diff to +111/−73.

---

## 5. Responsive behaviour

| | Mobile ≤639 | Tablet 640–1023 | Desktop ≥1024 |
|---|---|---|---|
| KPI cards | 2 cols | 2 cols | 4 cols |
| Register | horizontal pan, `min-w` preserved | full | full |
| Row actions | 36px | 28px | 28px |
| Entry dialog | full-screen `100dvh`, 1-col fields | `min(96vw,70rem)`, 2-col | `min(92vh,46rem)` tall, 4-col |
| Inputs | **16px** (stops iOS zoom-on-focus) | 12px compact | 12px compact |

---

## 6. Regression checklist

1. Create → save; totals match pre-change values for identical input.
2. Document-number sequence still increments.
3. Tab/Enter on the last editable cell still appends a row; invalid numeric still blocks focus.
4. Dependent sub-records still auto-sync; number formatting on blur unchanged.
5. File upload / extract / download links all still work.
6. Downstream hand-offs still fire (e.g. `ensureMillInwardFromGreyBill`).
7. Unsaved-changes dialog still intercepts close; Save Draft still persists.
8. Delete removes the row and its links.
9. **Every other desk renders unchanged** — the shared-component blast radius.
10. Print styles (`@media print`, `.no-print`) unaffected.

---

## 7. Status — Grey Purchase is complete

Signed off by the user. Everything below is done and verified by `tsc` / ESLint / structural
checks; none of it was confirmed in a browser by the author (see §8), but the user reviewed
the result on screen at each step.

| Delivered | Notes |
|---|---|
| Aurora Weave page scope, workspace texture, midnight app header | `.gb-page` / `.gb-app-header`, this route only |
| Page-header card removed | app-header crumb is the title; primary action moved into the register bar |
| One module name — **Grey Purchase** | nav, crumb, register, buttons, dialogs, notices |
| Glass + pearl KPI cards, incl. Net Value | `1 → 2 → 4` responsive |
| Ruled register, dark satin header, Date column, status chips corrected | `--gb-grid-strong` ruling |
| **Fixed 12-row register box** | `--gb-register-rows`; scrolls internally, page never scrolls |
| GP Entry rebuilt as a fixed-height workspace | locked regions, pinned action bar, `table-fixed` + colgroup |
| Roll/Taka sheet rebuilt | single table, sticky head, labelled summary |
| Delete confirm restyled with a danger action | "Cancel" / "Delete Grey Purchase" |
| Background scroll lock | opt-in `lockScroll` on `ErpModal` |
| Floating toast replaces the layout notice strip | tone-aware: ok / warn / error |
| Developer extraction log removed from the UI | replaced by one client-safe popover, 5s auto-dismiss + close |
| Filename no longer printed | name-free "Bill ready" chip in the sheet header |
| **INTELIXA** restored as the upload button name | spinner beside it while reading |
| Motion + `prefers-reduced-motion` throughout | |

### Deliberately not done

| Item | Why |
|---|---|
| Toast exit animation | entrance only; a safe exit needs timer state and this repo's `react-hooks/set-state-in-effect` rule makes that awkward |
| Challan upload button still reads "Upload Challan" | only the bill button was renamed to INTELIXA; ask before changing |
| ~10 "grey bill" strings in `server/actions/grey-bills.ts` | error paths only; server file intentionally untouched |
| `aria-invalid` + inline message on invalid numeric cells | red styling only; a blocked Tab is still unexplained |
| Escape-to-close on dialogs | `ErpModal` intercepts Tab only |
| Empty state does not distinguish "none yet" from "no search match" | same text for both |
| `"GP Entry"` dialog title | kept; GP abbreviates Grey Purchase |

### Pre-existing, unrelated, still open

`agent-master-desk.tsx` has 2 TypeScript errors (`ACCOUNT_TYPES` undefined);
`erp-shell.tsx:113` has a `react-hooks/set-state-in-effect` lint error;
`grey-purchase-desk.tsx` has an unused `_purchaseOrders` warning.
None were introduced by this work and none were touched.

### Final diff

`globals.css` **+1118 / −0** · `grey-purchase-desk.tsx` +188 / −109 ·
`erp-modal.tsx` **+14 / −0** · `grey-purchase-upload-test.tsx` +11 / −2 ·
`erp-shell.tsx` +7 / −3 · `flow.ts` +1 / −1.

Zero deletions in `globals.css` and `erp-modal.tsx` is the guarantee that no other desk
changed. **Nothing is committed** — the work sits in the working tree.

## 8. Honesty note

Nothing in this redesign was visually verified by the author. No browser was opened, no
screenshots taken, no runtime testing performed. All measurements quoted here were either
computed from the CSS or measured off screenshots supplied by the user. Verification was
limited to `tsc --noEmit`, `eslint`, CSS brace balance, JSX nesting inspection and column
counts. Carry that distinction into the next page: never report visual confirmation that did
not happen.
