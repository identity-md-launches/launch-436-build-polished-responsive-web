# SIMCARD data-layer repair: validation and Better Interface review

Date: 2026-09-29. Worker-reported checks, not independent certification.

## Scope and assumptions

Continued the existing React/TypeScript/Vite project. Scope: the data layer (sources, merging, polling, provenance labels) and the surfaces it feeds (agent page status line, profile dashboard cards). The animated card, token search, hash routes, PNG/video export, QR, profile links, X sharing, responsive layout and visual design were preserved; the profile keeps its card/grid layout. No chain deployment, wallet flow, backend, key or paid API was added. The pinned project notes, the Better Interface workflow, the six domain core sections and the documentation method were read.

The finished export is `dist/` (bundle `assets/index-Von05rbi.js`, styles `assets/index-CeTJ4zv2.css`). Build configuration and dependencies are unchanged. Consequential assumptions:

- `/swarm` is the primary live source because it is the only IdentityMD endpoint that answered browser CORS on 2026-09-29 (`Access-Control-Allow-Origin: *`, `Cache-Control: max-age=10`). The Explorer API, `/seats/*` and `/wallets/*` sent no CORS header; the site still requests them and treats a blocked request as "use the next source".
- The Explorer's `held` field is the number of seats the owner holds (18 for token 1's owner, matching the `/swarm` owner list), not a holding duration. It is shown as "Owner holds N seats" and never feeds "Held for".
- Rankings use the complete `/swarm` cohort (543 enrolled seats), then `/seats/records` (540), then the bundled snapshot (540).
- Presence is only taken from live sources (`working` in `/swarm`, `online` from the Explorer, heartbeat from standing when reachable). When none reports presence, the badge shows the latest live activity time.

## Commands and actual outcomes

Dependencies were installed only in a temporary mirror of the source under `$TMPDIR`; the repository's manifests and lockfile were not modified.

| Command / operation | Outcome |
| --- | --- |
| `npm ci` (temporary mirror, existing lockfile) | Exit 0, 104 packages. |
| `npm run typecheck` (`tsc --noEmit`) on final source | Exit 0. |
| `npm run build` (Vite 6.4.3) on final source | Exit 0; export copied to repository `dist/`. |
| `node test/scratch/data/live-test.mjs` (real network, tokens 222 and 1) | Exit 0, all assertions passed: full load, poll, `/swarm` blocked with last-good retention, `/swarm` + Explorer blocked, browser-realistic, browser-realistic with `/swarm` down, Ethereum blocked. Run three times during development; the final run used the final source. |
| `node test/scratch/harness/record.mjs` | Recorded 47 real responses (swarm, Explorer, seat, standing, earnings, JSON-RPC) for tokens 222 and 1 into a replay fixture. |
| `node test/scratch/browser/run-checks.mjs` (headless Chromium 1246 via the box's playwright-core, own bounded static server at `/preview/`) | Exit 0, **15 checks passed**, 0 console errors, 0 failed local asset loads. Results in `interaction-results.json`, contrast samples in `contrast-profile.json`, screenshots in this folder. |
| Manual review in the assignment's `browser` tool (serves the task directory, no internet) | Same harness at 1280×720, 320×900 and 390×844: real artwork, values, labels, poll behaviour and dialog inspected visually; console clean. |
| Endpoint probes with `curl` | `/swarm` 200 with CORS `*`; Explorer `/api/agents/{id}` 200 without CORS (404 for an unenrolled token); `/seats/records` 200 without CORS; publicnode rejects whole-range `eth_getLogs` as archive; `rpc.mevblocker.io` serves the whole range with CORS `*` but returned HTTP 429 and "service temporarily unavailable" under repeated runs. |

## Live data results (real network, Node)

| Token | Owner (onchain) | Stats (Live IMD) | Rank by accepted | Acquisition (onchain Transfer) |
| --- | --- | --- | --- | --- |
| 222 | `0xaf3c…70f9`, ENS bkm01.eth, holds 1 seat | 586 attempts, 486 accepted, 10 rejected, 64 failed, 26 pending | #303 of 543, 44th percentile | 2026-08-14 19:35:35 UTC, block 25,755,404, tx `0xbdce10b6…f5b81bd` |
| 1 | `0xbe11…97a9`, ENS 0xfinne.eth, holds 18 seats | 813 attempts, 733 accepted, 24 rejected, 37 failed, 19 pending | #188 of 543, 65th percentile | 2026-09-15 22:05:59 UTC, block 25,985,738, tx `0x738b07ef…d355654e` |

One unavailable endpoint never blanked another source's values: with `/swarm` blocked, statistics stayed on screen from the last good read (labelled with its time) or came from the Explorer and `/seats/records`; with Ethereum blocked, the owner came from the `/swarm` owner list and the card still rendered with artwork and "Held for" marked unavailable; with everything but the chain blocked, the snapshot supplied statistics and rankings and presence stayed unknown.

## Six-domain coverage

| Domain | Coverage and evidence | Explicit limits |
| --- | --- | --- |
| Accessibility | **Checked:** native dialog/details/buttons; Escape closes the profile and focus returns to Open profile (browser check 3); labels and `aria-invalid` on the search field (check 10); the live indicator is deliberately not a live region because it changes every second, and the status note that is a live region no longer contains a ticking time; provenance is text plus color; reduced motion renders a static card and disables Pause (check 12); 44px profile actions retained. | No screen-reader session, no physical device, no native 200% zoom, no full keyboard matrix beyond the dialog path. No automated axe scan this time. |
| Layout | **Checked:** rendered page and dialog at 320, 390, 1280 and 1440px with no horizontal overflow (checks 11, manual); the toolbar wraps badge, indicator and actions; inline source tags sit after values; heartbeat-only rows are omitted when empty instead of showing three Unavailable badges. | Intermediate widths not individually checked; RTL and localization expansion not tested. |
| Writing | **Checked:** user-facing failure copy reads "could not be refreshed", "not answering", "Ethereum could not be read"; no technical error text appears in cards (check 2 asserts this); labels are consistent (Live IMD, Explorer, Onchain, Snapshot); the Explorer `held` value is worded as seats held. | Upstream job objectives remain 180-character excerpts from the snapshot. |
| Typography | **Checked:** 12px uppercase labels, tabular numerals on the ticking indicator, large metric values unchanged; wrapping inspected at 320px in screenshots. | No multilingual shaping or text-enlargement check. |
| Colors | **Checked:** one hue per provenance meaning; 17 rendered foreground/background pairs measured against their real opaque backdrop, minimum **6.77:1** (muted time caption on `#252c36`), all above WCAG AA; Explorer sky `#7dd3fc` 8.44:1 on the panel and 12.14:1 on the page; retrying amber 12.13:1 on the page. | Gradients, artwork, translucent layers and dynamic NFT accents not exhaustively measured; one selector (the live-events eyebrow) had no instance in the recorded data and is recorded as missing, not passed. Dark theme only. |
| UI | **Checked:** normal/refreshing/retrying/unavailable/error states, poll retention state, missing-NFT state, reduced motion; indicator dot animates only under no-preference; screenshots of the final export reviewed. | Safari/Firefox, physical touch and a 10%-speed animation review not performed. |

## Findings, fixes and rechecks

| Severity | Final source location | Evidence / impact | Fix and recheck |
| --- | --- | --- | --- |
| High | `src/data/profile.ts:220`, `src/data/imdApi.ts:280` | Every browser request went to endpoints without CORS headers, so the whole profile showed Unavailable. | `/swarm` (browser-readable) is now primary; Explorer second; records only as fallback; field-by-field merge with the requested priority. Node live test and browser checks 1, 2, 6–8 pass. |
| High | `src/data/profile.ts:150`, `src/lib/hooks.ts:27` | No automatic refresh; a failed refresh could replace values. | 10-second poll while visible, last-good retention per source, "Live · updated X s ago / retrying" indicator. Checks 2 and 5 pass. |
| High | `src/data/config.ts:8`, `src/data/chain.ts:245` | "Held for" was never available in browsers: publicnode refuses whole-range logs; a 12-second head advance during the proof also failed closed. | Separate log-capable RPC list (mevblocker, flashbots), batched proof requests, head-advance handled by re-checking the pinned block and the gap for newer Transfers, one retry on HTTP 429 and transient errors. Real acquisitions resolved for 222 and 1; check 2 asserts 46 days / Aug 14 2026. |
| High | `src/data/imdApi.ts:150` | Explorer `held` could have been read as a duration. | Verified against the `/swarm` owner list; typed and shown as "Owner holds N seats". |
| Medium | `src/data/profile.ts:230` | Ethereum unreachable produced a blank error page even when public records knew the seat. | Degraded render: owner from Live IMD/Explorer/snapshot, artwork and acquisition unavailable with a plain note. Check 7 passes. |
| Medium | `src/components/ProfileDialog.tsx:88` | The status note was a live region containing a timestamp; with polling it would announce every 10 seconds. | Only the stable sentence is the live region; the time sits outside it; the ticking indicator is plain text. Source review. |
| Medium | `src/components/ProfileDialog.tsx:128` | Heartbeat-only rows showed three Unavailable badges in the normal browser case. | Rows render only when a value exists. Screenshot recheck (`dashboard-desktop-fixture.jpg`). |
| Medium | `src/components/common.tsx:16`, `src/styles/app.css:559` | Labels said "Live API" / "API snapshot" and had no Explorer variant. | Labels are Live IMD, Explorer, Onchain, Snapshot; sky token added and measured. |
| Low | `src/components/ProfileDialog.tsx:96`, `src/pages/AgentPage.tsx:139` | "Could not be refreshed" wording appeared when `/swarm` had never answered. | Wording keyed on whether a `/swarm` read ever succeeded. Check 6 asserts the "not answering" wording. |

## Screenshots (final export, real recorded data replayed offline)

- `profile-desktop-fixture.jpg`: 1440×1000 agent page for token 222 with the live indicator and source labels.
- `dashboard-desktop-fixture.jpg`: 1440×1000 profile dialog scrolled to Identity (Held for 46 days, Acquired Aug 14, 2026), Live status, Performance and Rankings.
- `profile-mobile-fixture.jpg`: 320×900 agent page.
- `dashboard-mobile-snapshot.jpg`: 320×900 profile dialog, one-column cards.

The artwork, values and dates in the screenshots are the real responses recorded from the public sources on 2026-09-29 (`test/scratch/harness/record.mjs`), replayed because the assignment's browsers have no internet. Nothing in the deployed export intercepts requests.

## Completion and remaining limits

**Complete for the stated scope.** Build, typecheck, real-network data tests and rendered interaction checks were performed; the export was inspected at mobile and desktop widths.

Limits: the Explorer, `/seats/*` and `/wallets/*` values were verified from Node and the replay harness because those origins do not answer browser CORS today; in a real browser those cards fall back to the snapshot until CORS is enabled or a first-party base is set. `rpc.mevblocker.io` rate-limited repeated test runs, so "Held for" can intermittently show Unavailable until Refresh. Screen readers, physical devices, Safari/Firefox, native zoom and a published IPFS round trip were not tested. The delivery (source, lockfile, export, evidence) stays well under the 8 MiB limit; artifact evidence uses the existing eight-file allowlist.
