# SIMCARD · animated identity cards for IdentityMD agents

SIMCARD turns any identity.md NFT into a personalised, animated agent card built from **public** data only: the NFT's original onchain SVG, the agent's public work record and live presence from the IdentityMD API, ENS, and rankings computed from the public records list. It is read-only. It never asks for a wallet connection, seed phrase, private key, approval or signature, deploys nothing, and creates no contracts.

- Static site: Vite + React + TypeScript, `base: './'`, hash routing (`#/agent/222`), suitable for IPFS gateways, ENS names and any folder.
- Live data: `https://api.imd.fun` (`/seats/:id`, `/seats/:id/standing`, `/seats/records`, `/wallets/:address/earnings`), `https://explorer.imd.fun/api/agents/:id`, Ethereum mainnet via public JSON-RPC (`tokenURI`, `ownerOf`, identity-hash flags, ENS reverse + forward check).
- Fallbacks: onchain reads always work from a browser; a build-time **snapshot** of the official API (`public/snapshot/*.json`) covers work statistics, rankings, Explorer names and the newest launch allocations when the API cannot be read cross-origin. Every value is labelled *Live API*, *Onchain*, *API snapshot* or *Unavailable*.
- Exports: PNG (1600×1000), a 6-second looping video (MP4 where the browser supports it, otherwise WebM) recorded from a canvas in the browser, an X post intent with caption and profile link, a real QR code to the profile URL.

## Install

```bash
npm install
```

Node 20+ is required (tested with Node 24.9, npm 11.6).

## Develop and preview

```bash
npm run dev        # Vite dev server with hot reload
npm run preview    # serves the production export from dist/
```

Open the printed URL and search for a token such as `222`, or open `#/agent/222` directly.

## Rebuild

```bash
npm run typecheck  # tsc --noEmit
npm run build      # vite build -> dist/ (relative asset URLs)
npm run check      # both
```

`dist/` is committed on purpose: the publisher serves the committed export and does not rebuild.

### Refresh the API snapshot

```bash
npm run snapshot   # node scripts/snapshot.mjs
npm run build
```

The snapshot script reads `GET /seats/records`, `GET /api/agents/:tokenId` for every seat with records and `GET /wallets/:address/earnings` for every owner wallet, then writes `public/snapshot/seats.json` (about 116 KB) and `public/snapshot/earnings.json` (about 400 KB, six newest allocations per wallet plus counts). Run it before each publish, or on a schedule (a cron job or CI workflow), so the fallback stays fresh. The site shows the snapshot timestamp wherever snapshot values are used.

## Publish to IPFS

The export is a plain folder. Any of these work:

```bash
# Kubo (go-ipfs)
ipfs add -r --cid-version 1 dist
# -> pin the printed CID, then open https://<gateway>/ipfs/<CID>/

# web3.storage / Storacha
w3 up dist

# Pinata, Fleek, 4EVERLAND: upload the dist/ folder in their dashboard or CLI
```

Point an ENS `contenthash` or a DNSLink at the CID for a stable address. Shareable profile links have the form `https://<gateway>/ipfs/<CID>/#/agent/222`; the QR code on each card encodes the URL the page is actually served from.

Before publishing, replace the relative `og:image` / `twitter:image` values in `index.html` with the absolute gateway URL of `og-image.png` if you want previews on X and other crawlers that require absolute image URLs.

## Data sources, CORS and limitations

- **CORS.** As of 2026-09-28 neither `api.imd.fun` nor `explorer.imd.fun` sends `Access-Control-Allow-Origin`, so browsers block direct reads from any other origin (verified with `curl -H "Origin: …"` and in headless Chromium: `TypeError: Failed to fetch`). The app still *tries* the official origins first on every load, so it becomes fully live the moment those headers appear. Until then, on IPFS the card shows: artwork, ownership, identity-hash flags and ENS **live from Ethereum** (public RPCs send `Access-Control-Allow-Origin: *`), and work statistics, rank, Explorer handle and allocations **from the snapshot** with its timestamp. Live presence (online / working / offline) is marked *Unavailable* in that mode and the card renders in its dimmed "status unavailable" state.
- **Operator proxy.** If you host the site behind your own CORS-enabled proxy of the same public routes, open *Data source settings* in the footer and enter the proxy base URLs (stored in `localStorage`, no rebuild needed). The live code path was validated by simulating exactly that in the browser checks below.
- **Social previews.** A static host cannot vary `<meta>` tags per agent; `index.html` carries site-level Open Graph / Twitter tags and a real card image (`public/og-image.png`, rendered from token 222). The app updates `document.title` per agent for script-executing clients.
- **Path URLs.** `/agent/222` cannot be served by a static host without rewrites, so the canonical link is `#/agent/222`. If a host does rewrite paths, or a link uses `?agent=222`, the app folds it into the hash form on load.
- **Privacy.** Only fields the official API exposes publicly are shown. Platform details in the standing record (OS, architecture, Node version) and anything resembling device or infrastructure data are never rendered. Full wallet addresses are hidden by default; the expanded profile shows a shortened address with a Copy button.
- **Video on X.** X's web intent cannot attach media; the page tells the user to download the video and attach it manually.
- **Earnings scope.** The API's earnings route currently lists launch allocations (Sepolia launches at the time of writing). The live mode shows the full list summary and newest allocations; the snapshot keeps the six newest per wallet.

## Validation performed

Run on 2026-09-28 against the committed export with a bounded script (`test/scratch/verify/run.mjs`, static server on a random port serving `dist/` under `/preview/`, headless Chromium 1246 via playwright-core, axe-core 4). The scratch folder is not part of the delivery; commands and outcomes:

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | exit 0 |
| Production build | `npm run build` | exit 0; `dist/index.html`, one JS chunk (≈319 KB, 102 KB gzip), one CSS file, one woff2, snapshot JSON, `og-image.png`, `favicon.svg` |
| Home, four widths (1280 / 820 / 390 / 320) | `node test/scratch/verify/run.mjs home` | no horizontal overflow, no console errors, axe: 0 violations |
| Search: invalid input, Enter submit | same | inline error "Enter a whole number between 1 and 2000, such as 222."; `222` + Enter navigates to `#/agent/222` |
| Agent 222, real network (API blocked by CORS) | `… blocked` | card renders with onchain artwork, ENS `bkm01.eth`, snapshot stats (355 accepted / 452 attempts / 78.5 %), QR alt links to profile URL, warning note explains the snapshot; dialog opens (focus → Close), Escape returns focus to "Open profile"; card click opens dialog; reduced-motion removes animations; axe: 0 violations page and dialog; no overflow at 390 / 320 |
| Agent 222, live API (CORS proxy simulated in the harness) | `… live` | state `working`, "Verified agent", runtime `codex codex-cli 0.155.1`, live presence, rank (#277 of 509 by accepted), 95 allocations, 10 work rows shown with "Show more"; Refresh re-fetches; Share on X href carries caption + URL; tokens 2 and 42 produce distinct accents (`#eab308`, `#ff3864`); mobile 390 no overflow |
| States | `… states` | invalid token, unpaired NFT (#1999 renders with owner and "Unavailable" stats), Ethereum unreachable (RPC aborted), loading, offline |
| Downloads | `… downloads` | `simcard-222.png` 1 719 903 B; `simcard-222.mp4` 1 500 900 B (Chromium picked `video/mp4`); success toasts shown |
| Social image | `… og` | `public/og-image.png` 1200×630 rendered from the live card |

Not performed: a screen-reader session, browser-native 200 % zoom (narrow viewports were tested instead), physical-device touch testing, Safari/Firefox runs (video export there falls back to WebM or reports unsupported), and the real IPFS gateway round trip (the export was served from a local static server at a subpath). Details, findings and fixes are in `artifacts/validation.md`; the design system is in `DESIGN.md`.

## Project layout

```
index.html              entry + social meta
public/                 favicon, og-image.png, snapshot/*.json
scripts/snapshot.mjs    build-time API snapshot
src/data/               API clients, onchain reads, palette extraction, profile assembly
src/lib/                card model, canvas renderer, exports, hooks, formatting
src/components/         SimCard, ProfileDialog, SearchForm, chrome, shared bits
src/pages/              HomePage, AgentPage
src/styles/             tokens.css, base.css, app.css, simcard.css
dist/                   committed production export
artifacts/              validation record and screenshots
```

## License and attribution

Application code: MIT. JetBrains Mono is bundled under the SIL Open Font License 1.1 (via `@fontsource-variable/jetbrains-mono`). Design review followed Jakub Krehel's Better Interface guide (MIT) with documentation guidance adapted from Paul Bakaus's Impeccable (Apache-2.0). IdentityMD, identity.md and the artwork belong to their respective owners; this is an unofficial community tool.
