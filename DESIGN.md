# Customer Hub — UI / UX handover

How the Customer Hub (`dataverse-rcportal`) looks and behaves, written so
another project can reproduce the same UI/UX. It pairs with `BRAND.md`
(the Redcentric palette, type and logo rules); this file is the layout and
component system built on top of that brand.

The visual language is **Tailwind Plus application-UI blocks, re-coloured
with the customer's tokens**. Every pattern below names the Plus block it
derives from, then gives the exact Tailwind recipe used here so it can be
copied without a Plus login. See "Licence" at the end before sharing code.

## Stack

| Piece | Choice | Notes |
| --- | --- | --- |
| Framework | React 19 + Vite | SPA, `react-router-dom` v7 for routing (`NavLink` drives active nav state) |
| CSS | Tailwind CSS v4 via `@tailwindcss/vite` | No `tailwind.config` — tokens live in `@theme` in `src/index.css` |
| Headless behaviour | `@headlessui/react` v2 | Only the mobile nav drawer (`Dialog`). Everything else is plain markup |
| Icons | Hand-drawn 24×24 stroke set in `src/components/common/Icon.tsx` | Lucide-style: `fill="none" stroke="currentColor" stroke-width="2"`, round caps |
| Fonts | Avenir (licensed, if installed) → Mulish (Google Fonts) → system | Set once in `@theme` as `--font-sans` |

No component library is installed. Components are small files you copy.

## Tokens (paste into `src/index.css`)

```css
@import 'tailwindcss';

@theme {
  --color-rc-navy: #142d46;        /* headings, body text, sidebar, top bar   */
  --color-rc-blue: #0066b3;        /* primary action, links, focus ring       */
  --color-rc-blue-light: #d9e8f4;  /* card borders, hairlines, tinted chips   */
  --color-rc-teal: #005862;        /* labels, meta, secondary text            */
  --color-rc-green: #1c6b4f;       /* gradient end-stop, success             */
  --color-rc-green-light: #d8f0f1; /* soft success surfaces                   */
  --color-rc-green-dark: #00272b;
  --color-rc-lime: #8dc63f;        /* sparing accent only — never fills/text  */
  --color-rc-canvas: #eef4fa;      /* page background                         */
  --font-sans: 'Avenir Next', 'Avenir LT Std', Avenir, Mulish, 'Segoe UI', system-ui, sans-serif;
}

body { color: var(--color-rc-navy); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
h1, h2, h3 { font-weight: 300; letter-spacing: -0.02em; }   /* light, airy headings */

/* Signature blue → teal → green rule (logo bars). Used as a 4px accent. */
.rc-gradient { background-image: linear-gradient(to right, #0a5ca8 0%, #0e8aa0 48%, var(--color-rc-green) 100%); }

/* Shared text input. */
.rc-input { border-radius: .5rem; border: 1px solid var(--color-rc-blue-light); padding: .5rem .75rem;
  font-size: .875rem; color: var(--color-rc-navy); background: #fff; }
.rc-input:focus { outline: none; border-color: var(--color-rc-blue);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-rc-blue) 25%, transparent); }
```

Colour roles in one line each: navy for anything that reads, blue for the
one primary action per view, teal for labels, blue-light for every border
and hairline, canvas behind everything, lime almost never.

Surface conventions: cards are `rounded-2xl border border-rc-blue-light
bg-white shadow-sm`; controls (buttons, inputs, chips) are `rounded-lg`;
pills are `rounded-full`. Shadows never go beyond `shadow-sm` on the page
(overlays use `shadow-xl`).

## Application shell

Derived from **Tailwind Plus → Application shells → Sidebar layouts →
"Simple sidebar"** (dark variant), re-coloured navy. Files:
`src/components/layout/AppShell.tsx`, `Sidebar.tsx`.

### Desktop (≥ `lg`, 1024px)

```
<div class="bg-rc-canvas min-h-screen">
  <aside class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col"> …sidebar… </aside>
  <div class="lg:pl-72">
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"> …routed page… </main>
  </div>
</div>
```

There is no top bar on desktop. The rail is 18rem wide and full height; the
page background is the flat canvas token (no gradients behind content).

### Mobile (< `lg`)

- A `sticky top-0 z-40 bg-rc-navy` top bar: hamburger (opens the drawer),
  white wordmark, company switcher, user avatar menu; `rc-gradient h-1`
  rule beneath. It slides away on scroll-down and returns on scroll-up
  (`useHideOnScroll`: 80px threshold, 10px hysteresis, never hidden near
  the top). Only transform while animating out — a permanent transform
  creates a compositing layer that makes dropdowns inside it flaky to tap.
- The same sidebar content renders inside a Headless UI `Dialog` drawer
  (`max-w-xs`, slides in from the left, navy backdrop at 60% with blur,
  close button in the 4rem gutter to its right). It closes on Escape,
  backdrop press, any route change, and any item press.

### Z-index ladder

| Layer | z | Why |
| --- | --- | --- |
| Mobile top bar, desktop rail | 40 | Sticky/fixed chrome |
| Anything pinned inside a page | 50 | Must clear the top bar |
| Portalled menus, toasts, the drawer | 60 | Escape the top bar's stacking context (menus render through a body portal) |
| Modal dialogs | 70 | Feedback dialog, plan modal |

### Sidebar anatomy (top to bottom)

1. **Brand block** — white wordmark (`h-7`) over a small product label
   (`text-xs font-medium tracking-wide text-white/60`), `px-6 pt-5 pb-4`.
2. **Gradient rule** — `rc-gradient h-1 w-full`. The brand's signature
   device; on the page it appears only here and on overlays.
3. **Sections** — one row per area, icon + label. Then a **Help** group and,
   for multi-company users, a **Your companies** group. Groups are separated
   by `gap-y-7`; group labels are sentence case, `px-3 text-xs font-semibold
   text-white/50`.
4. **User row** pinned to the bottom with `mt-auto`, full-bleed (`-mx-4`):
   avatar monogram + name + email, links to the profile; a sign-out icon
   button sits beside it.

Row recipe (links and buttons share it):

```
group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors
  inactive: text-white/70 hover:bg-white/5 hover:text-white
  active:   bg-white/10 text-white          ← the only active marker
icon: h-5 w-5 shrink-0 (inherits colour)
```

Company badge (the Plus "Your teams" lettered box): `flex h-6 w-6 shrink-0
items-center justify-center rounded-md border border-white/20 bg-white/5
text-[10px] font-semibold text-white/70 group-hover:text-white`, showing up
to two initials with stopwords (Ltd, plc, Group…) removed. The active
company also gets a `checkCircle` icon at `text-white/60`.

## Page anatomy

Derived from **Plus → Headings → Page headings** and **Section headings**.

- **Page header** (`src/components/common/PageHeader.tsx`): title
  `text-3xl font-light tracking-tight text-rc-navy`, subtitle
  `mt-0.5 text-sm text-rc-teal`, and an `actions` slot that sits on the right
  (`sm:flex-row sm:items-center sm:justify-between`). Scope and tier
  toggles live in that slot — nothing floats or sticks over content.
- **Section heading** (`SectionTitle` in `DetailChrome.tsx`):
  `mb-3 flex items-center gap-2 text-base font-semibold text-rc-navy` with a
  blue icon and an optional `(count)` in `text-sm font-normal text-rc-teal`.
- **Card heading** inside a card: `text-base font-semibold text-rc-navy`
  in a `px-6 py-5` body.
- Vertical rhythm: `mt-8` between page sections, `space-y-3` between list
  rows, `gap-4` in grids.

## Data display

### Stats panel

Derived from **Plus → Data display → Stats → "With trending" / "Simple"**:
one panel of hairline-divided cells, not separate cards.
File: `src/pages/DashboardPage.tsx` (`Stat`).

```
panel: grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-rc-blue-light bg-rc-blue-light/70 shadow-sm lg:grid-cols-5
cell:  relative block bg-white px-4 py-6 transition-colors hover:bg-rc-canvas sm:px-6   (a <Link>)
label: text-sm/6 font-medium text-rc-teal
value: mt-1 text-3xl/10 font-medium tracking-tight text-rc-navy
```

The `gap-px` background is what draws the hairlines, so the grid must never
show a hole: with five stats the last cell gets `col-span-2 lg:col-span-1`
so every row is full at every breakpoint. While loading, the value is an
`rc-skeleton mt-2 h-8 w-16 rounded` bar; when the number lands it fades up
(`rc-fade-up`, keyed by value so a change replays the entrance).

### Description list (detail pages)

Derived from **Plus → Data display → Description lists → "Two-column"**,
placed inside the **"Left-aligned in card"** card. Files:
`src/components/detail/DetailChrome.tsx` (`DetailHeader`, `MetaGrid`,
`MetaItem`), used by every `*DetailPage.tsx`.

```
card body:   px-6 py-5   (inside the standard card)
heading row: flex items-start justify-between gap-4
  glyph:     mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rc-blue-light text-rc-blue
  title:     text-2xl font-normal tracking-tight text-rc-navy
  subtitle:  mt-1 max-w-2xl text-sm/6 text-rc-teal
  trailing:  a status chip (see Controls)
list (<dl>): -mx-6 -mb-5 mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
row (<div>): border-t border-rc-blue-light/70 px-6 py-4      (+ sm:col-span-full for wide rows)
  <dt>:      flex items-center gap-1.5 text-sm/6 font-medium text-rc-teal   (with a h-4 w-4 icon)
  <dd>:      mt-1 whitespace-pre-wrap text-sm/6 text-rc-navy
```

Rules: a row with an empty value renders nothing (so pages list every field
they know about and the list self-trims); long text (descriptions, notes)
and rich content (a linked record, an editable field) go in `wide` rows,
last; the list is the last child of the card so its negative bottom margin
finishes flush with the card edge.

### Chart cards

Standard card, `px-5 py-5`, an icon chip (`h-7 w-7 rounded-lg bg-rc-blue-light
text-rc-blue`) beside a `text-sm font-medium text-rc-navy` title, chart body
below. Series colours come from `src/components/dashboard/palette.ts` and
are semantic (health, priority, state), not decorative. Cards unfold on
scroll (`rc-unfold`, staggered 90ms per card via `--rc-delay`).

### Lists

Derived from **Plus → Lists → Stacked lists**, but each row is a tappable
card rather than a divided list, which reads better on phones:

```
row:      w-full rounded-2xl border border-rc-blue-light bg-white p-4 text-left shadow-sm transition-colors hover:border-rc-blue hover:bg-rc-blue-light/40
row title: font-medium text-rc-navy      meta line: text-sm text-rc-teal      trailing: status chip
list:     space-y-3 rc-land-list       (newly appended rows fade up)
```

Above the list: a filter row (`FilterPills`) on the left and a sort row
(`SortMenu`) on the right, both pills (see Controls), with a `My / Company`
tier toggle in the page header's actions slot. Loading, empty and error
states come from `ListStates`; more rows load on scroll (`LoadMore`).

## Controls

| Control | Recipe |
| --- | --- |
| Primary button | `rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rc-navy disabled:opacity-50` — one per view |
| Secondary button | `rounded-lg border border-rc-blue-light px-4 py-2 text-sm font-medium text-rc-navy transition-colors hover:bg-rc-blue-light/40` |
| Icon button (on navy) | `rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white` |
| Pill (filter/sort) | `rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95`; active `rc-gradient text-white shadow-sm`, inactive `border border-rc-blue-light bg-white text-rc-teal hover:border-rc-blue hover:text-rc-navy` |
| Segmented toggle | container `inline-flex rounded-lg border border-rc-blue-light bg-white p-0.5 text-sm`; option `rounded-md px-3 py-1.5 font-medium`; active `bg-rc-blue text-white`, inactive `text-rc-teal hover:bg-rc-blue-light` |
| Status chip | `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium` + a `h-1.5 w-1.5 rounded-full` dot; tinted per state (`StatusChip.tsx`, `pills.ts`) |
| Text input / textarea | `.rc-input` (above); labels `text-xs font-medium text-rc-teal` stacked above |
| Back link | `text-sm font-medium text-rc-teal hover:text-rc-navy hover:underline` with a rotated chevron |
| Prev / next | `h-8 w-8 rounded-lg border border-rc-blue-light bg-white text-rc-navy hover:border-rc-blue hover:bg-rc-blue-light/40`; disabled `border-rc-blue-light/60 text-rc-navy/30` |

Errors stay semantic red (`text-red-600`), never a brand colour.

## Overlays

- **Dropdown menus** (`AnchoredMenu`): rendered through a body portal at
  `z-[60]`, `rounded-xl border border-rc-blue-light bg-white shadow-xl`,
  topped with the gradient rule; close on outside press (pointerdown, so the
  first tap works on touch), Escape, scroll and resize.
- **Modal dialogs** (`FeedbackDialog`, plan modal): `fixed inset-0 z-[70]`,
  backdrop `bg-rc-navy/40 backdrop-blur-sm`, panel `max-w-lg rounded-2xl
  border border-rc-blue-light bg-white shadow-xl` with the gradient rule.
- **Toasts**: fixed top-right, `z-[60]`.
- **Cookie notice**: fixed bottom card, decline is as prominent as accept.

## Motion

All in `src/index.css`, all disabled under `prefers-reduced-motion`.

| Class | Use |
| --- | --- |
| `rc-skeleton` | Loading blocks: a slow blue↔teal drift plus a sheen sweep; stagger rows with `--rc-delay` |
| `rc-fade-up` | Content entrance (0.35s, 8px rise) |
| `rc-land-list > *` | Newly appended list rows land |
| `rc-unfold` | Dashboard cards unfurl into view (0.5s, staggered) |
| `rc-progress` | Slim indeterminate bar while a list refetches |
| `rc-bar` | Equalizer bounce for the brand loader and "updating" chip |
| `rc-hero` | Drifting brand gradient — sign-in / join screens only |

## Brand devices, and when not to use them

- **Gradient rule**: sidebar, header of overlays, the brand loader. Not on
  content cards — the flat Plus look needs quiet cards.
- **Lime**: an accent dot or highlight at most. Not for active nav, not for
  fills, not for text.
- **Light headings**: `font-weight: 300` with tight tracking is the type
  voice; numbers and card headings use `font-medium` / `font-semibold` for
  legibility.
- **White on navy** for chrome; **navy on canvas** for content. Never white
  text on the page.

## Reproducing this in another project

1. Install: `tailwindcss @tailwindcss/vite @headlessui/react react-router-dom`.
2. Paste the tokens block above into your `index.css` and add the motion
   keyframes from this repo's `src/index.css` if you want the loaders.
3. Copy these files verbatim, then rename tokens/labels:
   `components/layout/{AppShell,Sidebar,AnchoredMenu,UserMenu,CompanySwitcher}.tsx`,
   `components/common/{Card,PageHeader,FilterPills,SortMenu,SegmentedToggle,StatusChip,ListStates,Skeleton,Toast,Icon}.tsx`,
   `components/detail/DetailChrome.tsx`, `components/dashboard/ChartCard.tsx`,
   `hooks/useHideOnScroll.ts`, and `pages/DashboardPage.tsx` for the stats panel.
4. Swap the `rc-*` hex values for the new customer's palette. Keep the roles
   (navy/blue/teal/blue-light/canvas) even if the hues change — the recipes
   depend on the roles, not the colours.
5. Keep the tests: each component above has a `*.test.tsx` beside it.

## Licence

The layouts are adapted from Tailwind Plus blocks. Tailwind Plus is licensed
per developer: anyone copying from tailwindcss.com/plus needs a seat. Using
the blocks inside an end product (a customer portal like this one) is
allowed, including in a public repository whose purpose is clearly the
product. What is **not** allowed is repackaging them — or our re-coloured
versions — as a starter kit, template or component library for others to
build from, whether public or sold. Copy between our own end products; do
not publish a kit.
