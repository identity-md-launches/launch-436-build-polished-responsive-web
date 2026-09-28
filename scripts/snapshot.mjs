#!/usr/bin/env node
// Build-time snapshot of the official IdentityMD public API.
//
// api.imd.fun and explorer.imd.fun do not send Access-Control-Allow-Origin,
// so a static site on IPFS cannot read them from the browser. This script
// runs server-side (a laptop, CI, a cron job), reads the same public routes
// the site would call, and writes compact JSON under public/snapshot/. The
// site tries the live API first and falls back to these files, labelling
// every value with its provenance and the snapshot time.
//
// Routes used (all public, no auth):
//   GET https://api.imd.fun/seats/records
//   GET https://explorer.imd.fun/api/agents/:tokenId
//   GET https://api.imd.fun/wallets/:address/earnings
//
// Usage: node scripts/snapshot.mjs [--concurrency 6] [--limit N]

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.IMD_API_BASE ?? 'https://api.imd.fun';
const EXPLORER = process.env.IMD_EXPLORER_BASE ?? 'https://explorer.imd.fun';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'snapshot');
const LATEST_PER_WALLET = 6;

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const CONCURRENCY = argValue('--concurrency', 6);
const LIMIT = argValue('--limit', Infinity);

async function getJson(url, { retries = 3, timeoutMs = 30_000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      clearTimeout(timer);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Every launch mints its own token, so per-token totals are as long as the
// allocation list itself. The snapshot keeps counts by chain, kind and status
// plus the newest allocations; the live API still serves the full list.
function summarizeEarnings(payload) {
  if (!payload || !Array.isArray(payload.earnings)) return null;
  const byChain = {};
  const byKind = {};
  const byStatus = {};
  for (const e of payload.earnings) {
    byChain[e.chainId] = (byChain[e.chainId] ?? 0) + 1;
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
  }
  const latest = [...payload.earnings]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, LATEST_PER_WALLET)
    .map((e) => ({
      launchId: e.launchId,
      launchNumber: e.launchNumber,
      status: e.status,
      chainId: e.chainId,
      kind: e.kind,
      symbol: e.token?.symbol ?? null,
      name: e.token?.name ?? null,
      address: e.token?.address ?? null,
      decimals: e.token?.decimals ?? 18,
      amount: String(e.amount ?? '0'),
      at: e.at,
    }));
  return { count: payload.count ?? payload.earnings.length, byChain, byKind, byStatus, latest };
}

async function main() {
  const generatedAt = new Date().toISOString();
  console.log(`[snapshot] reading ${API}/seats/records`);
  const records = await getJson(`${API}/seats/records`);
  if (!records || !Array.isArray(records.seats)) throw new Error('records payload missing seats[]');
  const seatList = records.seats.slice(0, LIMIT);
  console.log(`[snapshot] ${seatList.length} seats with records`);

  const seats = {};
  let explorerFailures = 0;
  await mapLimit(seatList, CONCURRENCY, async (seat, i) => {
    let explorer = null;
    try {
      explorer = await getJson(`${EXPLORER}/api/agents/${seat.tokenId}`);
    } catch (error) {
      explorerFailures += 1;
      console.warn(`[snapshot] explorer ${seat.tokenId}: ${error.message}`);
    }
    seats[seat.tokenId] = {
      agentId: seat.agentId ?? null,
      attempts: seat.attempts ?? 0,
      accepted: seat.accepted ?? 0,
      rejected: seat.rejected ?? 0,
      failed: seat.failed ?? 0,
      pending: seat.pending ?? 0,
      lastWorkedAt: seat.lastWorkedAt ?? null,
      owner: explorer?.owner ?? null,
      ownerName: explorer?.ownerName ?? null,
      held: typeof explorer?.held === 'number' ? explorer.held : null,
      online: typeof explorer?.online === 'boolean' ? explorer.online : null,
    };
    if ((i + 1) % 50 === 0) console.log(`[snapshot] explorer ${i + 1}/${seatList.length}`);
  });

  const wallets = [...new Set(Object.values(seats).map((s) => s.owner).filter(Boolean))];
  console.log(`[snapshot] ${wallets.length} owner wallets, reading earnings`);
  const earnings = {};
  let earningsFailures = 0;
  await mapLimit(wallets, CONCURRENCY, async (wallet, i) => {
    try {
      const payload = await getJson(`${API}/wallets/${wallet}/earnings`);
      const summary = summarizeEarnings(payload);
      if (summary) earnings[wallet.toLowerCase()] = summary;
    } catch (error) {
      earningsFailures += 1;
      console.warn(`[snapshot] earnings ${wallet}: ${error.message}`);
    }
    if ((i + 1) % 50 === 0) console.log(`[snapshot] earnings ${i + 1}/${wallets.length}`);
  });

  await mkdir(OUT_DIR, { recursive: true });
  const seatsFile = {
    generatedAt,
    sources: [`${API}/seats/records`, `${EXPLORER}/api/agents/:tokenId`],
    count: Object.keys(seats).length,
    seats,
  };
  const earningsFile = {
    generatedAt,
    sources: [`${API}/wallets/:address/earnings`],
    latestPerWallet: LATEST_PER_WALLET,
    wallets: earnings,
  };
  await writeFile(path.join(OUT_DIR, 'seats.json'), JSON.stringify(seatsFile));
  await writeFile(path.join(OUT_DIR, 'earnings.json'), JSON.stringify(earningsFile));
  console.log(
    `[snapshot] wrote ${OUT_DIR}/seats.json (${Object.keys(seats).length} seats, ${explorerFailures} explorer failures) ` +
      `and earnings.json (${Object.keys(earnings).length} wallets, ${earningsFailures} failures) at ${generatedAt}`,
  );
}

main().catch((error) => {
  console.error('[snapshot] failed:', error);
  process.exit(1);
});
