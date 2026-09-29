# SIMCARD design system

## Overview

SIMCARD turns public IdentityMD NFT and agent records into an animated card and a readable dashboard. The name and tagline are **SIMCARD — One card. Every agent. Verified onchain.** The visual character is a dark, monospaced cyber identity: graphite surfaces, one bundled monospace face, thin borders, and an accent palette extracted from each NFT's own artwork. The audience is IdentityMD agent owners and observers who want to check a seat's status and share it.

Two rules run through every page. First, every value carries its provenance: a small uppercase label (**Live IMD**, **Explorer**, **Onchain**, **Snapshot**, or **Unavailable**) sits next to the section or the value it describes, and a compact **Live · updated X s ago** indicator shows when live data was last read. Second, missing data is shown as a quiet "Unavailable" badge for that one field, never as an error message and never as a zero.

The profile dashboard uses brighter charcoal surfaces than the page, eight separate cards in a two-column grid, and large numerals. Those dashboard treatments are scoped to `.profile-dialog`; the homepage and the card keep their own darker surfaces. One page's arrangement (hero, actions column, dialog grid) is not a rule for every future page; the tokens, primitives and provenance pattern are.

## Colors

Canonical shared tokens live in `src/styles/tokens.css`. Dashboard overrides live in `src/styles/profile.css`, imported after the other styles by `src/main.tsx`. Values are hex (or `rgb()` with alpha for borders); keep that notation.

| Role / token | Shared site (`tokens.css`) | Profile dashboard (`profile.css`, `.profile-dialog`) |
| --- | --- | --- |
| Page `--color-bg-page` | `#060608` | unchanged around the dialog |
| Background `--color-bg-graphite` | `#0b0b0f` | `#1b2028` |
| Panel `--color-bg-surface` | `#101014` | `#252c36` |
| Raised `--color-bg-raised` | `#15151b` | `#2d3541` |
| Hover `--color-bg-hover` | `#1c1c24` | `#35404e` |
| Border subtle / strong | white at 8% / 16% | `#3d4857` / `#59677b` |
| Primary text `--color-text-primary` | `#ececf1` | `#f4f6fa` |
| Secondary text `--color-text-secondary` | `#9a9aa6` | `#c1cad6` |
| Muted text `--color-text-muted` | `#83838f` | `#a9b5c5` |
| Status ready / working / danger | `#4ade80` / `#fbbf24` / `#f87171` | same |
| Focus `--color-focus` | `#ffffff`, 2px ring + 2px offset | same; `Highlight` in forced colors |

Provenance colors, one hue per meaning (`src/styles/app.css`, `.source-tag--*` and `.live-indicator--*`):

| Meaning | Token | Value | Where |
| --- | --- | --- | --- |
| Live IMD (`/swarm`, live API) | `--color-status-ready` | `#4ade80` | source tags, live indicator dot |
| Explorer | `--sky-300` | `#7dd3fc` | source tags |
| Onchain | `--color-accent-text` | per NFT, lifted for contrast | source tags |
| Snapshot, and "retrying" | `--amber-400` | `#fbbf24` | source tags, live indicator while a refresh fails |
| Unavailable | `--color-text-muted` | see table | tags and badges |

Every color is paired with a text label; state and provenance are never color alone. `src/data/artwork.ts` extracts the NFT palette; `ProfileDialog` lifts the primary accent toward white until it reaches at least 4.5:1 on the dashboard panel `#252c36`, and that inline `--color-accent-text` wins over the CSS fallback. Rendered contrast for the label and indicator colors on their real opaque backdrops was measured in `artifacts/contrast-profile.json`; gradients, artwork and translucent layers are not measured.

## Typography

One bundled variable font: **JetBrains Mono Variable**, weights 100–800, normal style, Latin WOFF2 from `@fontsource-variable/jetbrains-mono` (declared in `tokens.css` with `font-display: swap`). Fallbacks: `ui-monospace`, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace.

Scale (`tokens.css`): 12px captions and labels (`--text-xs`), 13px secondary UI, 14px compact body, 16px body and inputs, 20px h3, 26px h2, fluid 32–52px home h1. Profile h2 is fluid 24–32px at 1.25 line height. Dashboard card headings are 22px/600 (20px on mobile). Regular metric values are 24px/600; prominent values are fluid 28–40px at 1.3 line height and −0.04em tracking. Ownership duration is 28px and the acquisition date 20px.

Labels that describe provenance (`.source-tag`, `.profile-eyebrow`) are 12px uppercase with 0.04–0.09em tracking. The live indicator is 12px with `tabular-nums` so the seconds count does not jitter. Body line height is 1.55; small explanatory copy is 1.5. Numbers inherit tabular figures. Headings wrap balanced, prose wraps pretty, and IDs, addresses and long values use `overflow-wrap: anywhere`. Unavailable badges use 12px regular type, never metric type. Inputs stay 16px.

## Layout

Shared 4px spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px (`--space-*`). Primitives in `src/styles/app.css`: `.container` (content capped at 72rem), `.stack`, `.cluster`, `.panel`, `.btn`, `.status-line`, `.note`. The agent page switches to a card column plus an actions column at 66rem.

The profile modal caps at 76rem with 1rem viewport margins and a scrollable height of `100dvh − 2rem`; its header stays visible while scrolling. Body padding is 32px; the animated card is centered within 44rem, with the status badge, live indicator and Pause/Refresh actions in one wrapping toolbar above it. Dashboard cards use a two-column `repeat(2, minmax(0, 1fr))` grid with a 20px gap and 24px card padding; metric pairs share a two-column grid; key/value rows use a `minmax(6rem, .65fr) minmax(0, 1fr)` grid.

At **54rem or below** the dashboard becomes one column and body padding becomes 20px. At **40rem or below** the modal fills the viewport, loses its outer radius, and padding becomes 16px; key/value rows and ownership metrics stack, the profile artwork caps at 240px and the card's six fields keep two columns. The standalone card keeps its 34rem/22rem container-query breakpoints. Observed in the final export: no horizontal overflow on the page or in the dialog at 320, 390 and 1440px. Widths in between were not individually checked.

## Elevation & depth

Grouping comes from opaque raised panels and 1px borders, not shadows. The animated card and the modal keep `--shadow-card` (an inset white highlight, 24px/60px dark shadow and a faint outer ring). The modal's dark translucent backdrop uses a 4px blur. Stacking: dialog header sticky at z-index 2 inside the modal; page header 20; toast 50; skip link 100. Native `showModal()` puts the profile in the browser top layer.

The card keeps its orbit, pulse and scanline animation, sped up while working and dimmed while offline (`stateTiming` in `src/lib/cardModel.ts`). Pause/Resume is a visible control; `prefers-reduced-motion` renders a static card and disables it. The live indicator's dot reuses the `live-dot` keyframes only under `prefers-reduced-motion: no-preference`.

## Shapes

Radii: 6px chips and badges (`--radius-sm`), 10px buttons and inputs, 16px panels, cards and the dialog (`--radius-lg`), 20px for the SIMCARD, and pill radius for status badges and the live indicator. NFT artwork keeps a 1px white-at-10% outline. The SIM-chip wordmark motif and card corner decoration are preserved.

## Components

- **SearchForm** (`src/components/SearchForm.tsx`): labeled token input, Enter submission, numeric keyboard, inline validation with `aria-invalid`, focus on error, compact variant. Routes are `#/agent/:tokenId`.
- **SimCard** (`src/components/SimCard.tsx`): original artwork, status badge with a live label, six fields, state animations, QR code and a work-data source line. `onOpen` is optional; `staticRender` pauses motion. The adjacent Open profile button is the keyboard path.
- **StatusBadge** (`src/components/common.tsx`): dot plus text for `working | ready | online | offline | unknown`; accepts a `label` so the unknown state can read "Last active 3 h ago" when only activity time is known.
- **SourceTag** (`common.tsx`): the provenance label. Props `source` (`live | explorer | onchain | snapshot | unavailable`), `at`, `note`; the title carries the time and a plain-language note. Use it in a card heading through `Panel` and inline next to any value whose source differs from its card.
- **LiveIndicator** (`common.tsx`): "Live · updated X s ago", "Live · retrying · last update X s ago" or "Live · waiting for the first update". Props `at`, `ok`, `now`; it is plain text, not a live region, because it changes every second. Pair it with `useNow(1000)` from `src/lib/hooks.ts`.
- **Unavailable** (`common.tsx`): compact muted badge with an optional explanation in the title and visually hidden text. Absence never becomes a zero.
- **ProfileDialog** (`src/components/ProfileDialog.tsx`): native modal with controlled Escape cancellation, Close/backdrop actions and focus restoration. Private `Panel`, `Metric`, `Value` and `Source` helpers define the dashboard pattern: `Panel` shows the card's source, `Value` renders a value with an inline tag when its source differs. Rows that only exist for one endpoint (heartbeat details) are omitted rather than shown empty. Verification is a native closed `<details>`.
- **Buttons** (`app.css`): primary fill, neutral, ghost and small variants; profile buttons keep a 44px minimum height. Exactly one primary action per view (Open profile on the agent page, Generate SIMCARD in the search form).
- **Data layer** (`src/data/profile.ts`, `src/lib/hooks.ts`): `Sourced<T>` (`value`, `source`, `at`, `note`) is the shape every displayed field uses; `useProfile` loads, polls every 10 seconds while visible, and never replaces the profile on screen with an error on a failed poll.
- **CardModel / canvas exports** (`src/lib/cardModel.ts`, `cardCanvas.ts`, `exports.ts`): the shared model behind the DOM card, PNG and video; the work-data source line and activity source survive export.
- **Data source settings** (`src/components/Chrome.tsx`): one optional trusted HTTPS base URL with inline validation. No wallet UI exists.

## Do's and don'ts

- Start a new view from `.container` plus `.stack`/`.cluster`; reuse `.panel` on the page and `.dashboard-card` inside the profile.
- Display any external value as a `Sourced<T>` and label it with `SourceTag`; never invent a value, and never turn an absent number into 0.
- Keep provenance colors in their roles: green for live, sky for Explorer, the NFT accent for onchain, amber for snapshot and for a failing refresh. Do not reuse amber for warnings elsewhere without the text that explains it.
- Write user-facing failures in plain words ("could not be refreshed", "not answering"); technical error text belongs in the console only.
- Presence must come from a live source. Snapshot online flags never decide the badge.
- "Held for" comes only from the verified onchain Transfer. Do not fall back to pairing dates, snapshot dates or the Explorer's `held` count (that is a number of seats).
- Keep the card's palette per NFT and never substitute a generic avatar.
- Use native controls; keep the visible white focus ring, reduced-motion behaviour and the pause action.
- To add a page: add a route in `src/router.ts` and `src/App.tsx`, reuse SearchForm and the primitives, use hash navigation so gateway subpaths work without rewrites, and label every fetched value.

Design guidance: Jakub Krehel's Better Interface (MIT, pinned `267330e1adfc66a718fb65fa6918c1f06d0a689e`). Documentation method: Paul Bakaus's Impeccable (Apache-2.0, pinned `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). License texts are retained in `artifacts/licenses/better-interface-LICENSE`.
