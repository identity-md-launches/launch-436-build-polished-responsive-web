# SIMCARD design system

## Overview

SIMCARD turns public IdentityMD NFT and agent records into an animated card and a readable dashboard. The name and tagline are **SIMCARD — One card. Every agent. Verified onchain.** The existing artwork, cyber styling, monospaced type, animated orbits, search and export flows remain. Each NFT supplies its own palette.

The profile uses brighter charcoal surfaces, eight separate cards and large numeric values. Identity, presence, work performance and rankings come before rewards, history, reviews and the collapsed Verification card. These dashboard treatments are scoped to `.profile-dialog`; the established homepage and card retain their own surfaces.

## Colors

Canonical shared tokens are in `src/styles/tokens.css`. Dashboard overrides are in `src/styles/profile.css`, imported after the original styles by `src/main.tsx`.

| Role / token | Shared site | Profile dashboard |
| --- | --- | --- |
| Page `--color-bg-page` | `#060608` | Surrounding page unchanged |
| Background `--color-bg-graphite` | `#0b0b0f` | `#1b2028` |
| Panel `--color-bg-surface` | `#101014` | `#252c36` |
| Raised `--color-bg-raised` | `#15151b` | `#2d3541` |
| Hover `--color-bg-hover` | `#1c1c24` | `#35404e` |
| Border subtle / strong | White at 8% / 16% | `#3d4857` / `#59677b` |
| Primary text | `#ececf1` | `#f4f6fa` |
| Secondary text | `#9a9aa6` | `#c1cad6` |
| Muted text | `#83838f` | `#a9b5c5` |
| Ready / working / danger | `#4ade80` / `#fbbf24` / `#f87171` | Same |
| Focus | White, 2px perimeter + 2px offset | Same; system `Highlight` in forced colors |

`src/data/artwork.ts` extracts the NFT palette from its actual artwork. `ProfileDialog` lifts the primary accent toward white to at least 4.5:1 on the dashboard panel `#252c36`. This inline `--color-accent-text` wins over the fallback in CSS. `AgentPage` retains the existing page accent handling. The SIMCARD itself retains its gradients and independent `--card-accent*` values; profile card text uses `#ececf1`, `#b5b5c1`, `#a9a9b6`. Colors always accompany text labels for status and provenance. Rendered contrast scope and limitations are in `artifacts/validation.md`.

## Typography

One bundled variable font: **JetBrains Mono Variable**, weights 100–800, normal, local Latin WOFF2 from the existing font dependency. Fallbacks: `ui-monospace`, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace. The font face uses `font-display: swap`.

Shared scale: 12px captions, 13px secondary UI, 14px compact body, 16px body/input, 20px h3, 26px h2, fluid 32–52px home h1. Profile h2 is fluid 24–32px with 1.25 line-height. Dashboard headings are 22px/600 (20px on mobile). Regular metric values are 24px/600; prominent values are fluid 28–40px with 1.3 line-height and −0.04em tracking. Ownership duration is 28px and acquisition date 20px.

Body line-height is 1.55; small explanatory copy stays 1.5. Numbers inherit `tabular-nums`. Headings use balanced wrapping, prose pretty wrapping, and IDs/long values `overflow-wrap: anywhere`. Unavailable badges use normal 12px type, not oversized metric type. Inputs remain 16px. Snapshot timestamps are visible captions beside source labels. Collapsible work objectives expose the available excerpt without clipping it; the linked job provides the complete record.

## Layout

Shared 4px spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Use `.container`, `.stack`, `.cluster`, `.panel`, `.btn` from `app.css`. The page content caps at 72rem; the existing agent page switches to card/actions columns at 66rem.

The profile modal caps at 76rem, leaving 1rem viewport margins and a scrollable height of `100dvh - 2rem`. The header stays visible during scrolling. Body padding is 32px; the original animated card is centered within 44rem. Dashboard cards use a two-column `repeat(2, minmax(0, 1fr))` grid, a 20px gap and 24px card padding. Metric pairs share a two-column grid.

At **54rem or below**, dashboard cards become one column and body padding becomes 20px. At **40rem or below**, the modal fills the viewport, loses outer radius, and body/header padding becomes 16px. Cards use 20px padding, key/value rows stack, and ownership metrics stack. The profile's artwork caps at 240px and its six card fields retain two columns to reduce mobile scrolling. The original standalone card still uses its 34rem/22rem container-query breakpoints. There are no horizontally scrolling dashboard tables.

## Elevation & depth

Dashboard grouping comes from opaque raised panels and 1px borders. The animated card and modal retain `--shadow-card`: inset white highlight, 24px/60px dark shadow and a faint outer ring. The modal's dark translucent backdrop uses a 4px blur. Header is sticky at z-index 2 inside the modal; page header uses 20, toast 50 and skip link 100. Native `showModal()` puts the profile in the browser top layer.

The original card keeps orbit, pulse, scanline and state-speed animation. A visible Pause/Resume action controls it; reduced motion forces a static card. The hidden copy behind an open profile is static. PNG remains static; explicit video export still records animation.

## Shapes

Existing radii remain: 6px chips, 10px buttons/inputs, 16px panels/dialog, 20px SIMCARD and pill badges. Dashboard cards use 16px. NFT artwork retains the 1px white-at-10% image outline. The SIM-chip wordmark motif and card corner decoration are preserved.

## Components

- **SearchForm** (`src/components/SearchForm.tsx`): labeled token input, Enter submission, numeric keyboard, inline validation, invalid-field focus and compact form variant. Routes use `#/agent/:tokenId`.
- **SimCard** (`src/components/SimCard.tsx`): original artwork, six fields, state animations, QR and source note. `onOpen` is optional for a display-only card inside the profile; `staticRender` pauses motion. The adjacent Open profile button remains the keyboard path.
- **ProfileDialog** (`src/components/ProfileDialog.tsx`): native modal with controlled Escape cancellation, Close/backdrop actions and focus restoration. Private `Panel`, `Metric`, `Source` and `VerificationLink` helpers define the dashboard pattern. Refresh keeps existing content while retrying sources. Work/reviews reveal more in increments; Verification is a native closed `<details>`.
- **SourceTag / Unavailable** (`src/components/common.tsx`): textual provenance indicators and compact muted badges. Unavailable explanations are exposed through short adjacent copy, native title text and visually hidden text. Absence never turns into a zero.
- **Buttons** (`app.css`): primary fill, neutral, ghost and small variants. Profile buttons keep a 44px minimum height. Focus, hover, pressed, disabled and loading states reuse the established rules.
- **CardModel / canvas exports** (`src/lib/cardModel.ts`, `cardCanvas.ts`, `exports.ts`): shared values/palette for DOM, PNG and video. Snapshot work timestamps and runtime/activity source markers survive export. QR, copied link and X intent use the same canonical hash URL.
- **Data source settings** (`src/components/Chrome.tsx`): one optional trusted HTTPS proxy URL with inline validation. No wallet UI is present.

## Do's and don'ts

- Reuse the existing tokens and primitives; scope future dashboard surface overrides to the dashboard.
- Keep important metrics large and explanations short. Put technical links in Verification.
- Show source and capture time with snapshot values; distinguish unavailable from recorded zero and wallet allocations from paid rewards.
- Keep NFT artwork and palette individual. Never substitute a generic avatar in production.
- Use native controls and preserve visible focus, reduced motion and the pause action.
- Add a page via `router.ts`/`App.tsx`, reuse `.container` and SearchForm, and use hash navigation so gateway subpaths work without rewrites.

Design guidance: Jakub Krehel’s Better Interface (MIT, pinned `267330e1adfc66a718fb65fa6918c1f06d0a689e`). Documentation method: Paul Bakaus’s Impeccable (Apache-2.0, pinned `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). License texts are retained in `artifacts/licenses/better-interface-LICENSE`.
