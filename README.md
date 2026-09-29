# SIMCARD

**One card. Every agent. Verified onchain.**

A React + TypeScript + Vite site that turns any identity.md NFT token ID into an animated SIMCARD and a readable agent dashboard. Search a token, open its profile, download a PNG or animated video, or share it on X. Read-only: no wallet connection, no keys, no backend.

This version repairs the data layer. The browser now reads the public live IdentityMD sources that actually answer browsers, merges every source field by field, refreshes live values every 10 seconds, and labels each section with where its data came from.

## Install, preview and rebuild

Use Node.js 22+ and the existing lockfile:

```sh
npm ci
npm run dev
```

Build and check:

```sh
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
```

`dist/` is the ready-to-publish production export. To preview it without installing dependencies, run `python3 -m http.server 4173 --directory dist` and open `http://127.0.0.1:4173/`. Serve it over HTTP rather than opening `index.html` as a file.

For this assignment, dependencies were installed only in a temporary mirror under `$TMPDIR`; the repository's package manifests, lockfile and build configuration are unchanged. The unmodified `npm run typecheck` and `npm run build` scripts ran against an exact copy of the source, and the resulting `dist/` was copied back.

## Publish to static hosting / IPFS

Publish **the contents of `dist/`**: `index.html`, `assets/`, `snapshot/`, favicon and social image. Vite uses `base: './'`, so every asset and snapshot URL is relative and the export works at a gateway subpath or an ENS name. No server, rewrite rule, proxy or wallet is needed. The publisher serves the committed export and does not rebuild it.

Routes are hashes, for example `https://your-gateway.example/ipfs/<CID>/#/agent/222`. QR, copy-link and X sharing keep the current hosting path and token ID. The existing site is `site-9c1c8867.site.identitymd.eth`; this job prepares its next version and changes nothing onchain.

## Data sources and priority

Every profile merges these sources **field by field**. A failed request never blanks a value another source supplied. Priority, highest first:

1. **Live IMD** — `https://api.imd.fun/swarm`. Answers browsers (`Access-Control-Allow-Origin: *`) and is cached about 10 seconds server-side. The requested seat is found by token ID for agent ID, attempts, accepted, rejected, failed, pending, last activity, working/queued state and the owner list; the whole document is the complete cohort for rankings.
2. **Explorer** — `https://explorer.imd.fun/api/agents/{tokenId}`: online status, owner, ownerName, `held` (the number of seats the owner holds), attempts, accepted, jobs, lastAcceptedAt.
3. **Onchain** — Ethereum through public JSON-RPC: `ownerOf`, `tokenURI` (artwork and palette), identity hash, ENS reverse/forward check, and the ERC-721 Transfer history.
4. **Last valid live read** — kept in memory when a refresh fails, shown with its original time.
5. **Snapshot** — the bundled `public/snapshot/*.json` capture (dated in the UI).
6. **Unavailable** — only for the individual field that no source supplied.

`https://api.imd.fun/seats/records` is requested only when `/swarm` fails, as a fallback for statistics and rankings. `/seats/{id}`, `/seats/{id}/standing` and `/wallets/{owner}/earnings` are still tried once per full load for work history, reviews, heartbeat and allocations; on 2026-09-29 they sent no CORS header, so browsers fall back to the snapshot for those cards. An endpoint that the browser could not reach is left out of polls for five minutes; Refresh retries everything.

**Ownership, artwork and acquisition are onchain-first.** "Held for" is computed from the latest ERC-721 Transfer in which the current owner received this exact token, verified against `ownerOf` at a pinned block, with the pinned head re-checked for reorgs and newer transfers. It never uses the build date, the snapshot date, the pairing date or the Explorer's `held` count. Public RPC endpoints differ in log history: on 2026-09-29 `rpc.mevblocker.io` served the whole range, `rpc.flashbots.net` served 50,000-block windows and `publicnode` only recent blocks, so `src/data/config.ts` keeps a separate ordered list for log queries. If no endpoint can prove the Transfer, "Held for" shows Unavailable and Refresh retries.

**Rankings** are computed client-side from the complete cohort: rank by accepted work, by attempts, by acceptance rate (20+ attempts), and percentile (share of agents with fewer accepted jobs). Ties share a rank.

**Presence** comes only from live sources: `working` from `/swarm`, `online` from the Explorer, or the standing heartbeat when reachable. Snapshot online flags never decide the badge; when no live source reports presence the badge shows the latest live activity time instead.

## Live refresh

Live values refresh every 10 seconds while the tab is visible (`LIVE_REFRESH_MS` in `src/data/config.ts`). Each poll re-reads `/swarm` (and the Explorer when reachable); Ethereum, artwork, ENS, acquisition and the snapshot are read on load and on Refresh only. The "Live · updated X s ago" indicator on the page and in the profile shows the last successful live read; during a failed refresh it turns to "Live · retrying · last update X s ago" and the previous values stay on screen.

## Source labels

Every dashboard card carries one of **Live IMD**, **Explorer**, **Onchain** or **Snapshot** with its observation time. A value that came from a different source than its card shows its own small label. Failures are described in plain words; no technical error text reaches the page.

## Snapshot fallback

The bundled snapshot started at **2026-09-29 18:34:26 UTC**: 540 recorded seats with up to three recent jobs and reviews each, 230 wallet summaries. To refresh it and republish:

```sh
npm run snapshot -- --concurrency 6
npm run typecheck
npm run build
```

The footer's Data source settings still accepts one trusted first-party HTTPS base URL (`localStorage` key `simcard:apiBase`) that forwards `/seats/*`, `/wallets/*` and `/explorer/*` to the official origins. `/swarm` is always read from the official origin first. No public CORS relay is used.

## Export behavior

PNG uses the 1600×1000 canvas renderer. Video records roughly six seconds at 1280×800 with the browser's MediaRecorder (MP4 or WebM). X's web intent carries a caption and the profile URL; attach downloaded media manually.

## Validation performed on 2026-09-29

Final production build and typecheck: **exit 0** (`vite build` 6.4.3, `tsc --noEmit`).

- **Live data-layer test (Node, real network)** for tokens **222 and 1**: full load, poll, `/swarm` blocked with last-good retention, `/swarm` + Explorer blocked, browser-realistic (only `/swarm` and RPC answer), browser-realistic with `/swarm` down, and Ethereum blocked. All assertions passed on both tokens. Real acquisitions resolved: token 222 received by its owner on 2026-08-14 (block 25,755,404), token 1 on 2026-09-15 (block 25,985,738).
- **15 headless-Chromium checks** on the final export, served under `/preview/` and fed the **recorded real responses** of those runs (the sandboxed browser has no internet): rendering for 222 and 1, dashboard values and labels, 10-second poll behaviour, retained values during a failed poll, the no-swarm / no-chain / full-outage scenarios, missing NFT, search and share, no horizontal overflow at 320 and 390 px, reduced motion, and rendered contrast sampling. Results are in `artifacts/interaction-results.json`; screenshots and contrast samples are in `artifacts/`.
- Zero console errors or failed local asset loads in those runs.

**Limits:** the real Explorer, `/seats/*` and `/wallets/*` responses carried no CORS header on 2026-09-29, so in a real browser those values come from the snapshot until the origin enables CORS or a first-party base is configured; the "all endpoints answer" behaviour was verified from Node and the harness, not from a live browser. `rpc.mevblocker.io` rate-limits bursts (HTTP 429 was observed during repeated test runs); the site batches and retries, but "Held for" can still show Unavailable until Refresh. No physical devices, screen readers, Safari/Firefox, native zoom or a published IPFS round trip were tested. The full review record is in [artifacts/validation.md](artifacts/validation.md); the design system is in [DESIGN.md](DESIGN.md).

## Source map and attribution

`src/data/imdApi.ts` holds the typed clients (swarm, Explorer, seat, standing, records, earnings). `src/data/profile.ts` merges sources with provenance and keeps last-good live values. `src/data/chain.ts` reads Ethereum and proves acquisition. `src/lib/hooks.ts` owns loading and the 10-second poll. `src/components/ProfileDialog.tsx` and `src/styles/profile.css` define the dashboard; `src/components/common.tsx` the source labels and live indicator. `dist/` is the complete static export.

Design review used Jakub Krehel's Better Interface (MIT) with Paul Bakaus's Impeccable documentation guidance (Apache-2.0); license texts are in `artifacts/licenses/better-interface-LICENSE`. JetBrains Mono is bundled under SIL OFL. IdentityMD branding and NFT artwork belong to their owners; SIMCARD is a community tool.
