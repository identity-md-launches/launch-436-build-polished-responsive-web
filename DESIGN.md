# SIMCARD design system

This documents the design as implemented in the final source. Values are quoted from `src/styles/*.css` and the components that consume them; observed behaviour comes from the headless-Chromium checks recorded in `artifacts/validation.md`.

## Overview

SIMCARD is a single-purpose tool for IdentityMD agents and the people who follow them: type a token ID, get a card. The visual character is premium, minimal cyberpunk in the spirit of the identity.md artwork: near-black and graphite surfaces, one monospaced family everywhere, thin hairline borders, restrained glow, and a **per-NFT accent** lifted from the token's own SVG. Hierarchy comes from size and weight, not colour; colour is reserved for the accent (interactive and identity), three statuses and the data-provenance tags.

System-wide rules: dark only, one type family, 4 px spacing steps, concentric radii, borders for structure and layered shadows for the two elevated surfaces (card and dialog). Page-specific: the home hero and feature grid, the two-column agent layout. The card itself is a reusable component with its own container-query breakpoints.

## Colors

All tokens live in `src/styles/tokens.css` as hex custom properties. Primitives are named by value and never used in components; components use the semantic tier only.

| Role | Token | Value | Notes |
| --- | --- | --- | --- |
| Page background | `--color-bg-page` | `#060608` (`--graphite-950`) | body, with a faint radial highlight |
| Graphite background | `--color-bg-graphite` | `#0b0b0f` | dialog, inner stat tiles, share URL box |
| Surface | `--color-bg-surface` | `#101014` | panels, inputs, feature cards, chips |
| Raised | `--color-bg-raised` | `#15151b` | buttons, toasts |
| Hover | `--color-bg-hover` | `#1c1c24` | button hover |
| Subtle border | `--color-border-subtle` | `rgb(255 255 255 / 0.08)` | dividers, panel borders |
| Strong border | `--color-border-strong` | `rgb(255 255 255 / 0.16)` | inputs, buttons, dialog |
| Image outline | `--color-image-outline` | `rgb(255 255 255 / 0.1)` | 1 px pure-white outline on artwork |
| Primary text | `--color-text-primary` | `#ececf1` | 16.7:1 on graphite-900 (measured) |
| Secondary text | `--color-text-secondary` | `#9a9aa6` | 7.1:1 on graphite-900 |
| Muted text | `--color-text-muted` | `#83838f` | 5.25:1 on graphite-900, 4.52:1 on graphite-700; raised from `#6b6b78` after axe flagged 3.7:1 |
| Inverse text | `--color-text-inverse` | `#060608` | text on accent fills |
| Accent (fill) | `--color-accent` | default `#22d3ee`; per NFT `palette.fill` | primary button background; the palette lifts it until `#060608` text reaches 4.6:1 |
| Accent 2 / 3 | `--color-accent-2`, `--color-accent-3` | default `#a78bfa`, `#67e8f9`; per NFT | second/third orbit hues, primary hover |
| Accent text | `--color-accent-text` | default `#67e8f9`; per NFT `palette.text` | links, eyebrow, card number; lifted until 4.5:1 on `#0b0b0f` |
| Status ready | `--color-status-ready` | `#4ade80` | also used for the "Live API" tag |
| Status working | `--color-status-working` | `#fbbf24` | also used for the "API snapshot" tag |
| Status offline | `--color-status-offline` | `#83838f` | |
| Status unknown | `--color-status-unknown` | `#9a9aa6` | |
| Danger | `--color-danger` | `#f87171` | invalid input border and error text |
| Focus | `--color-focus` | `#ffffff` | 2 px outline, 2 px offset; `Highlight` under forced colours |

Per-NFT accents are computed in `src/data/artwork.ts` (`paletteFromSvg`, `paletteFromImage`, `liftForContrast`) and applied by `src/pages/AgentPage.tsx` to the root and by `src/components/SimCard.tsx` to the card (`--card-accent*`). Status is never colour-only: every status dot sits beside a text label.

## Typography

- Family: `--font-mono` = `'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`. One local file, `jetbrains-mono-latin-wght-normal.woff2` (weight axis 100–800, latin subset, 40 KB), declared in `tokens.css` and bundled from `@fontsource-variable/jetbrains-mono`. Italic is used once (the *Unavailable* value) and is synthesised; no other styles are needed.
- Smoothing is set once on `html`; `font-variant-numeric: tabular-nums` is set on `body` so every changing number stays stable.
- Scale (`tokens.css`): `--text-xs` 12 px labels/captions, `--text-sm` 13 px secondary UI, `--text-md` 14 px UI default, `--text-base` 16 px body and inputs, `--text-lg` 20 px h3 and stat values, `--text-xl` 26 px h2 and page titles, `--text-2xl` `clamp(2rem, 1.2rem + 3vw, 3.25rem)` for the home h1. The card number uses `clamp(1.5rem, 3cqi + 0.5rem, 2.25rem)`.
- Weights: 400 body, 500 buttons and card values, 600 section headings and stat values, 650 h2, 700 h1/wordmark/card number. Nothing below 400.
- Line height: headings 1.1 (`--leading-tight`), body 1.55 (`--leading-body`), badges 1.3.
- Letter spacing: uppercase labels `+0.08em` (`--tracking-label`), headings `-0.02em`, wordmark `+0.12em`.
- Wrapping: `text-wrap: balance` on headings, `pretty` on paragraphs, `overflow-wrap: anywhere` on values, IDs and the share URL; `white-space: nowrap` on badges and buttons. Long prose is capped at `--measure` (64ch).
- Casing is applied with `text-transform: uppercase` on labels (`h4`, `.simcard__label`, `.stat dt`, `.badge`, `.source-tag`); copy is stored in natural case.

## Layout

- Spacing: 4 px steps `--space-1` … `--space-8` (4, 8, 12, 16, 24, 32, 48, 64 px). Intra-group gaps use 8–12 px, inter-group 24–32 px, sections 48–64 px.
- Content width: `.container` = `min(100% - 2 * var(--gutter), 72rem)`, `--gutter` = `clamp(1rem, 4vw, 2.5rem)`. Logical properties (`inset-inline`, `padding-inline`, `margin-inline`) are used for direction-dependent spacing.
- Primitives (`app.css`): `.container`, `.stack` (vertical flex, 16 px gap), `.cluster` (wrapping horizontal flex), `.panel` (surface card with 24 px padding), `.stats` (auto-fit grid, 8.5rem minimum), `.kv` (definition grid, collapses to one column below 30rem), `.actions` (auto-fit button grid, 10rem minimum), `.link-grid` (auto-fit, 14rem).
- Breakpoints come from content: the agent page becomes two columns (`1.5fr / minmax(18rem, 1fr)`) at `66rem`; the wordmark subtitle hides below `40rem`; the dialog goes full-screen below `40rem`; the `.kv` grid stacks below `30rem`. The card uses **container queries** (`container-name: simcard`): landscape (11fr/14fr) by default, portrait below `34rem` of its own width, single-column field grid below `22rem`.
- Sticky header floats over content with a translucent graphite blur; the dialog header is sticky inside the dialog.
- Overflow: tables sit in `.table-wrap` (`overflow-x: auto`); everything else reflows. Verified in Chromium at 1280, 820, 390 and 320 px with no horizontal page scroll.

## Elevation & depth

- Flat by default: panels, inputs and chips use 1 px borders (`--color-border-subtle` / `--color-border-strong`) rather than shadows.
- Two elevated surfaces: the card (`--shadow-card`: inset hairline highlight + 24 px/60 px black shadow + 1 px white ring at 6 %) and toasts (`--shadow-raised`). The dialog reuses `--shadow-card` over a `rgb(0 0 0 / 0.7)` blurred backdrop.
- Artwork gets a 1 px pure-white outline at 10 % (`--color-image-outline`) inset via `outline-offset: -1px`.
- Glow is restrained: a text-shadow on the card number (`--card-accent` at 45 %), radial accent washes on the card background at 12–14 %, and the pulsing centre light rendered with `mix-blend-mode: screen`.
- Stacking: header `z-index: 20`, toasts 50, skip link 100; the card uses `isolation: isolate` so blend modes stay inside it.

## Shapes

- Radii: `--radius-sm` 6 px (chips, share URL, small buttons), `--radius-md` 10 px (buttons, inputs, stat tiles, link tiles), `--radius-lg` 16 px (panels, artwork frame, dialog), `--radius-card` 20 px (the card), `--radius-pill` for badges. Nested radii are concentric: card 20 px with 24 px padding wraps the 16 px artwork frame; buttons 10 px inside 16 px panels.
- Borders are 1 px; the chip glyph and pills use 1.5 px.
- The SIM-chip motif appears twice as a decorative form: the wordmark chip and the card corner chip (hidden in the portrait card).

## Components

- **Search form** — `src/components/SearchForm.tsx`, styles `.search*`. Visible `<label>`, numeric `inputmode`, `enterKeyHint="go"`, hint text tied via `aria-describedby`, inline `role="alert"` error with `aria-invalid`, submit stays enabled and focuses the field on error. Props: `compact`, `autoFocus`, `initialValue`. Input is 16 px so iOS does not zoom.
- **Buttons** — `.btn`, variants `.btn--primary` (accent fill, dark text, one per view), `.btn--ghost`, `.btn--sm`. 44 px minimum height (36 px for small), `scale(0.96)` on press, hover gated by `@media (hover: hover)`, `:disabled` at 55 % opacity, spinner via `.spinner` while busy with the label kept.
- **Badges and tags** — `StatusBadge` and `SourceTag` in `src/components/common.tsx`. `.badge--{ready|working|online|offline|unknown}` sets `--status-color` for the dot (pulsing only under `prefers-reduced-motion: no-preference`); `.source-tag--{live|onchain|snapshot|unavailable}` marks provenance with a square swatch and text.
- **SimCard** — `src/components/SimCard.tsx` + `simcard.css`. Props: `model: CardModel`, `onOpen`, `staticRender`. Renders artwork with three overlay layers (two counter-rotating orbit SVGs, a pulse, a scan line, a live dot), the six-field grid, status and verification badges, meta and QR. State classes `.simcard--{working|ready|online|offline|unknown}` set `--orbit-duration`, `--pulse-duration`, `--scan-duration` and `--card-dim` from `stateTiming()` in `src/lib/cardModel.ts` (working 8 s / 1.2 s / 2.5 s, ready 24 s / 3.2 s / 6 s, offline 48 s / 6 s / 12 s at 72 % opacity, unknown 36 s / 4.5 s / 9 s at 85 %). Under reduced motion all keyframes are removed and the scan line is hidden. The container click is a pointer convenience; the keyboard path is the "Open profile" button.
- **ProfileDialog** — `src/components/ProfileDialog.tsx`, styles `.profile-dialog*`. Native `<dialog>` opened with `showModal()`, labelled by its heading, focus goes to Close on open and back to the trigger on close; Escape and backdrop click close it; `overscroll-behavior: contain`. Sections use `.profile-section` with a `SourcedHeading` (title + provenance tag), `.kv` lists, `.stats` tiles, `.table-wrap` tables with "Show more" buttons, `.chip-list` traits and `.link-grid` verification links.
- **QrCode** — `src/components/common.tsx`. Data-URL image from `qrcode`, white quiet zone, alt text names the URL.
- **Toast** — `src/components/Chrome.tsx`. Stable polite live region rendered before text appears; routine notices auto-clear after 6 s, errors (`role="alert"`) stay until dismissed.
- **Header / Footer / Data source settings** — `src/components/Chrome.tsx`. Skip link targets `<main id="main">`. The footer `<details>` holds an optional proxy configuration form with labelled URL inputs.
- **Canvas card renderer** — `src/lib/cardCanvas.ts` draws the same `CardModel` at 1600×1000 for PNG and video, using the same palette, fields and status colours as the DOM card.

## Do's and don'ts

- Start a new page from `.container` and `.stack`/`.panel`; put long prose in a `.note` or paragraph capped by `--measure`.
- Use one `.btn--primary` per view for the main action; everything else is `.btn` or `.btn--sm`. Keep button labels verb-first and sentence case ("Download PNG", "Open profile").
- Use semantic tokens only. Never reference `--graphite-*` in a component; add a semantic token if a role is missing.
- Colour never carries meaning alone: pair every status colour with its text label, every provenance colour with its tag text.
- Any new changing number inherits `tabular-nums` from `body`; do not override it.
- Animation is opt-in: wrap new motion in `@media (prefers-reduced-motion: no-preference)` or the `.simcard--static` pattern, and give it a static cue.
- Keep the card's six fields and label vocabulary (`Agent ID`, `Accepted`, `Attempts`, `Acceptance`, `Runtime`, `Owner`) in sync between `cardModel.ts` and the canvas renderer; both read the same model.
- Do not add a light theme, a second type family or new accent hues; the accent is the NFT's.

Recipe for another page: add a route in `src/router.ts`, create `src/pages/NewPage.tsx` returning `<div className="container">…</div>` with `<h1>` first, use `.panel` for grouped content and `.stats`/`.kv` for data, reuse `SourceTag` for provenance and `SearchForm compact` for the token entry, and render it from `App.tsx`.
