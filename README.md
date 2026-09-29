# SIMCARD

**One card. Every agent. Verified onchain.**

An existing React + TypeScript + Vite site, improved with a readable IdentityMD agent dashboard. Search an NFT token ID, open its profile, refresh public data, download a PNG or animated video, or share its profile on X. No wallet connection or credentials are required.

## Install, preview and rebuild

Use Node.js 22+ and the existing dependency lockfile:

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

`dist/` is the ready-to-publish production export. To preview it without installing dependencies, run `python3 -m http.server 4173 --directory dist` and open `http://127.0.0.1:4173/`. Serve over HTTP, rather than opening `index.html` as a file.

For this assignment, dependencies were installed only in a temporary mirror under `/tmp`; the repository's package manifests, lockfile and build configuration were preserved. The same unmodified `npm run typecheck` and `npm run build` scripts ran against exact source/config copies. No dependency/cache directory belongs in the submission.

## Publish to static hosting / IPFS

Publish **the contents of `dist/`**, including `index.html`, `assets/`, `snapshot/`, favicon and social image. Vite retains `base: './'`; runtime assets and snapshots use relative URLs. No server, rewrite rule, proxy or wallet is required to serve the export. Publish the rebuilt export alongside source and the existing lockfile; this project's publisher serves the supplied files and does not rebuild them.

Routes are hashes, for example `https://your-gateway.example/ipfs/<CID>/#/agent/222`. QR, copy-link and X sharing preserve the current hosting path and token ID. The existing site is `site-9c1c8867.site.identitymd.eth`; this task prepares its next version but does not publish it or change anything onchain. Static social metadata remains site-wide, since hash routes cannot provide separate server-rendered previews.

## Dashboard and data

Open profile keeps the original animated SIMCARD above eight separate cards: Identity, Live status, Performance, Rankings, Rewards and launch allocations, Work history, Reviews, and a collapsed Verification card. Desktop uses two columns; mobile uses one. Missing values use small Unavailable badges. Source labels and snapshot timestamps remain visible without opening JSON.

Every load and Refresh requests these official public sources independently:

- `https://api.imd.fun/seats/:tokenId`
- `https://api.imd.fun/seats/:tokenId/standing`
- `https://api.imd.fun/seats/records`
- `https://api.imd.fun/wallets/:ownerAddress/earnings`
- `https://explorer.imd.fun/api/agents/:tokenId` and its public `/agents/:tokenId` page
- Ethereum `ownerOf`, `tokenURI`, identity metadata, ENS and ERC-721 Transfer logs.

**Held for** comes exclusively from the latest Transfer of the specific NFT in `0x0000ec93127baa929e58e97dd0095a2bfb38ec1d`, matched against its current owner. The block timestamp supplies the readable duration and exact UTC acquisition date; Verification links the transaction. Pairing time, Explorer `held`, API timestamps and general contract activity are never substitutes. Chain identity, ownership, event fields and canonical block/head hashes are checked. The bounded history search returns Unavailable if logs are incomplete, providers fail, ownership changes or the chain head advances during verification. Refresh retries it.

Work counts retain null for missing values, distinguishing unknown from zero. Acceptance is **accepted / all attempts**, including pending work; this can differ from the Explorer's judged-work denominator. Ties share ranks. Acceptance-rate ranks require 20 attempts, and rankings require a complete records cohort. Percentile is the proportion of other recorded agents with fewer accepted jobs. Wallet allocations can cover multiple agents and networks; their amounts are not aggregated across unlike tokens or described as confirmed payouts. Payouts remain Unavailable because these public responses do not establish them. Paginated allocation counts are labeled as the captured page rather than lifetime totals.

## CORS, snapshots and a future first-party proxy

During this task the official API and Explorer omitted browser CORS headers. The frontend still retries the official origins; it uses **no public CORS proxy**. Successful sources remain usable when a sibling endpoint fails. Public Ethereum data supplies verified ownership/artwork; bundled snapshots supply dated work records, rankings, runtime, recent work/reviews and wallet allocation records. Presence is never inferred from snapshot online flags.

The bundled snapshot started at **2026-09-29 18:34:26 UTC**: 540 recorded seats (all enriched with up to three recent jobs and reviews), 230 wallet summaries, and up to six allocations per wallet. Seat detail timestamps are separate. Objectives are compact 180-character excerpts with links to full public jobs. Snapshot values do not update themselves on IPFS; refresh the files and republish to advance this fallback:

```sh
npm run snapshot -- --concurrency 6
npm run typecheck
npm run build
```

The script reads only public endpoints. A partial `--limit` snapshot is unsuitable for rankings and is marked incomplete. Its source files are in `public/snapshot/` and copied into `dist/snapshot/` by Vite.

The footer's Data source settings accepts **one trusted first-party HTTPS base URL**, stored in `localStorage` as `simcard:apiBase`. Leave it empty for official origins. A future proxy at `https://first-party.example/public` must forward:

| Requested path | Official upstream |
| --- | --- |
| `/public/seats/*` | `https://api.imd.fun/seats/*` |
| `/public/wallets/*` | `https://api.imd.fun/wallets/*` |
| `/public/explorer/*` | `https://explorer.imd.fun/*` |

It must return upstream response bodies/statuses and permit the frontend origin through CORS. This static export does not include or operate that service. Credentials, query strings and fragments are rejected in the setting. Public verification links always point to the official sites.

If Ethereum itself cannot be read, the site shows a network error with Try again instead of claiming snapshot ownership is current. Public provider range limits can leave acquisition Unavailable even while other onchain reads work.

## Export behavior

PNG uses the existing 1600×1000 canvas renderer. Video records roughly six seconds at 1280×800 using a supported browser MediaRecorder format (MP4 or WebM). It requires a browser that can record canvas video; an unsupported browser retains PNG export and shows an explanation. The source timestamp is included for snapshot work data. X's web intent supplies a caption and profile URL; attach downloaded media manually. Onscreen Pause and reduced motion do not disable an explicitly requested video export.

## Validation performed on 2026-09-29

Final production build and typecheck: **exit 0**. The final `dist/` was tested at the static `/preview/` subpath; source/config mirror parity was checked.

- **26 browser checks passed**: search/invalid input/loading, direct and malformed hash routes, clipboard/X URL, native modal/Escape/reopen, disclosures, recent-work expansion, pause/reduced motion, Refresh, partial and unavailable sources, one proxy base, missing NFT and network recovery.
- **19 acquisition/RPC regression tests passed**, including latest log ordering, contiguous scans, different token/contract, reorgs, ownership/head changes and partial RPC errors.
- **31 data assertions passed**: missing versus zero, presence, ranking ties/cohort completeness, allocation pagination and identity matching.
- Real PNG and video encoding/downloads passed with fixture records. The PNG's QR decoded to the exact current profile URL; the video decoded at 1280×800 with 5.989 seconds duration.
- No horizontal overflow at 320, 390, 820 or 1280px. Screenshot review also covered 1440px and final 320px snapshot cards. Measured opaque dashboard text samples met their contrast thresholds; see the full coverage record.

**Limits:** worker and browser requests to the three real RPC endpoints were blocked (HTTP 403/network failures); the actual acquisition date and real live onchain export could not be certified here. Live-state browser tests used explicit synthetic API/RPC fixtures; the bundled API snapshot is real. Screenshots marked `fixture` use synthetic artwork/data. Screen-reader sessions, native 200% zoom, physical devices, Safari/Firefox and a published IPFS round trip were not performed. Axe's inconclusive contrast nodes are recorded, not counted as passes.

The six-domain Better Interface review, findings/fixes, actual commands, screenshots and limitations are in [artifacts/validation.md](artifacts/validation.md); the implemented design is in [DESIGN.md](DESIGN.md). Temporary test scaffolding and generated download samples were kept in `test/scratch/` and are deliberately not submitted.

## Source map and attribution

`src/data/` handles provenance, public endpoints, snapshots and onchain reads. `src/components/ProfileDialog.tsx` and `src/styles/profile.css` define the dashboard; `src/lib/` retains shared card/export logic. `public/` supplies locally bundled assets and snapshots; `dist/` is the complete static export.

Design review used Jakub Krehel's Better Interface (MIT), with Paul Bakaus's Impeccable documentation guidance (Apache-2.0). Their pinned license texts are retained in `artifacts/licenses/better-interface-LICENSE`. JetBrains Mono is bundled under SIL OFL through the existing font dependency. IdentityMD branding and NFT artwork belong to their respective owners; SIMCARD is a community tool.
