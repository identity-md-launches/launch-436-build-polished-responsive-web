// Read-only Ethereum access with hand-rolled ABI encoding. Calls, blocks and
// logs never need a signer, wallet provider or transaction submission.

import { keccak_256 } from '@noble/hashes/sha3';
import { COLLECTION_ADDRESS, ENS_REGISTRY, LOG_RPC_ENDPOINTS, RPC_ENDPOINTS } from './config';
import { HttpError, postJson } from './http';

type RpcResponse<T = string> = { id: number; result?: T; error?: { code: number; message: string } };

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function keccakHex(data: Uint8Array | string): string {
  return toHex(keccak_256(typeof data === 'string' ? enc.encode(data) : data));
}

export function selector(signature: string): string {
  return '0x' + keccakHex(signature).slice(0, 8);
}

export function encodeUint(value: number | bigint): string {
  return BigInt(value).toString(16).padStart(64, '0');
}

export function encodeBytes32(hex: string): string {
  return hex.replace(/^0x/, '').padStart(64, '0');
}

export function decodeUint(data: string): bigint {
  const clean = data.replace(/^0x/, '');
  return clean.length === 0 ? 0n : BigInt('0x' + clean.slice(0, 64));
}

export function decodeBool(data: string): boolean {
  return decodeUint(data) !== 0n;
}

export function decodeAddress(data: string): string {
  const clean = data.replace(/^0x/, '').padStart(64, '0');
  return '0x' + clean.slice(24, 64);
}

export function decodeString(data: string): string {
  const clean = data.replace(/^0x/, '');
  if (clean.length < 128) return '';
  const offset = Number(BigInt('0x' + clean.slice(0, 64))) * 2;
  const length = Number(BigInt('0x' + clean.slice(offset, offset + 64)));
  const hex = clean.slice(offset + 64, offset + 64 + length * 2);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return dec.decode(bytes);
}

export function namehash(name: string): string {
  let node: Uint8Array = new Uint8Array(32);
  if (name) {
    const labels = name.split('.');
    for (let i = labels.length - 1; i >= 0; i -= 1) {
      const labelHash = keccak_256(enc.encode(labels[i] ?? ''));
      const joined = new Uint8Array(64);
      joined.set(node, 0);
      joined.set(labelHash, 32);
      node = keccak_256(joined);
    }
  }
  return '0x' + toHex(node);
}

export interface Call {
  to: string;
  data: string;
  validate?: (result: string) => boolean;
}

/**
 * Batched eth_call against the first usable RPC. Only an explicit EVM revert
 * becomes null; an incomplete batch or service error retries another endpoint.
 */
export async function ethCallBatch(calls: Call[]): Promise<(string | null)[]> {
  const body = calls.map((call, i) => ({
    jsonrpc: '2.0',
    id: i + 1,
    method: 'eth_call',
    params: [{ to: call.to, data: call.data }, 'latest'],
  }));
  let lastError: unknown = null;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const responses = await postJson<RpcResponse[] | RpcResponse>(endpoint, body);
      const list = Array.isArray(responses) ? responses : [responses];
      const byId = new Map(list.map((r) => [r.id, r]));
      return calls.map((call, i) => {
        const r = byId.get(i + 1);
        if (r?.error && /(?:\bexecution reverted\b|\bVM Exception\b.*\brevert(?:ed)?\b)/i.test(r.error.message)) return null;
        if (r?.error || typeof r?.result !== 'string' || !/^0x(?:[0-9a-f]{2})*$/i.test(r.result) ||
          (call.validate && !call.validate(r.result))) throw new Error('Incomplete or failed RPC call');
        return r.result;
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof HttpError ? lastError : new HttpError('unreachable', RPC_ENDPOINTS[0] ?? '', 'No RPC answered');
}

const SEL = {
  ownerOf: selector('ownerOf(uint256)'),
  tokenURI: selector('tokenURI(uint256)'),
  hasIdentityHash: selector('hasIdentityHash(uint256)'),
  identityHash: selector('identityHash(uint256)'),
  identityHashLocked: selector('identityHashLocked(uint256)'),
  totalSupply: selector('totalSupply()'),
  resolver: selector('resolver(bytes32)'),
  name: selector('name(bytes32)'),
  addr: selector('addr(bytes32)'),
};

export interface OnchainToken {
  owner: string | null; // null when the token does not exist (ownerOf reverted)
  tokenURI: string | null;
  hasIdentityHash: boolean | null;
  identityHash: string | null;
  identityHashLocked: boolean | null;
  totalSupply: number | null;
}

export async function readToken(tokenId: number): Promise<OnchainToken> {
  const id = encodeUint(tokenId);
  const results = await ethCallBatch([
    {
      to: COLLECTION_ADDRESS,
      data: SEL.ownerOf + id,
      // ERC-721 ownerOf either returns one nonzero address word or reverts.
      // Empty/zero/malformed success results are provider failures, not proof
      // that this token is unminted.
      validate: (result) => /^0x0{24}[0-9a-f]{40}$/i.test(result) && !/^0x0{64}$/i.test(result),
    },
    { to: COLLECTION_ADDRESS, data: SEL.tokenURI + id },
    { to: COLLECTION_ADDRESS, data: SEL.hasIdentityHash + id },
    { to: COLLECTION_ADDRESS, data: SEL.identityHash + id },
    { to: COLLECTION_ADDRESS, data: SEL.identityHashLocked + id },
    { to: COLLECTION_ADDRESS, data: SEL.totalSupply },
  ]);
  const [owner, uri, hasHash, hash, locked, supply] = results;
  const ownerAddress = owner ? decodeAddress(owner) : null;
  return {
    owner: ownerAddress,
    tokenURI: uri && uri.length > 130 ? decodeString(uri) : null,
    hasIdentityHash: hasHash ? decodeBool(hasHash) : null,
    identityHash: hash && hash.length > 130 ? decodeString(hash) : null,
    identityHashLocked: locked ? decodeBool(locked) : null,
    totalSupply: supply ? Number(decodeUint(supply)) : null,
  };
}

export interface Acquisition {
  acquiredAt: string;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  owner: string;
  verifiedAtBlock: number;
}

interface RpcBlock {
  number: string;
  hash: string;
  timestamp: string;
}

interface TransferLog {
  address: string;
  topics: string[];
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  logIndex: string;
  removed: boolean;
}

const TRANSFER_TOPIC = '0x' + keccakHex('Transfer(address,address,uint256)');
const HASH_PATTERN = /^0x[0-9a-f]{64}$/i;
const QUANTITY_PATTERN = /^0x[0-9a-f]+$/i;
const ACQUISITION_BUDGET_MS = 25_000;
const ACQUISITION_MAX_REQUESTS = 64;

class RpcReadError extends Error {}

function quantity(value: unknown): number {
  if (typeof value !== 'string' || !QUANTITY_PATTERN.test(value)) throw new Error('Invalid RPC quantity');
  const n = Number(BigInt(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid RPC quantity');
  return n;
}

function blockData(value: RpcBlock | null): RpcBlock {
  if (!value || !HASH_PATTERN.test(value.hash)) throw new Error('Missing canonical block');
  quantity(value.number);
  quantity(value.timestamp);
  return value;
}

function latestTransfer(logs: unknown, tokenTopic: string, fromBlock: number, toBlock: number): TransferLog | null {
  if (!Array.isArray(logs)) throw new Error('Invalid logs response');
  let latest: TransferLog | null = null;
  for (const entry of logs) {
    const log = entry as TransferLog | null;
    // Reject an inconsistent result instead of silently ignoring a possibly
    // newer transfer. ERC-721 has four indexed topics, unlike ERC-20 Transfer.
    if (!log || log.address?.toLowerCase() !== COLLECTION_ADDRESS.toLowerCase() || log.removed !== false ||
      !Array.isArray(log.topics) || log.topics.length !== 4 ||
      log.topics.some((topic) => typeof topic !== 'string' || !HASH_PATTERN.test(topic)) ||
      log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC || log.topics[3]?.toLowerCase() !== tokenTopic ||
      !HASH_PATTERN.test(log.blockHash) || !HASH_PATTERN.test(log.transactionHash)) {
      throw new Error('Unverifiable Transfer log');
    }
    const block = quantity(log.blockNumber);
    const index = quantity(log.logIndex);
    if (block < fromBlock || block > toBlock) throw new Error('Transfer outside requested range');
    if (!latest || block > quantity(latest.blockNumber) ||
      (block === quantity(latest.blockNumber) && index > quantity(latest.logIndex))) latest = log;
  }
  return latest;
}

/**
 * Find the latest ERC-721 Transfer for this exact NFT, then verify its recipient
 * against ownerOf at one pinned Ethereum head. Newer ranges must all be checked
 * before an older event can be used. The timestamp comes only from that event's
 * canonical block, never from pairing, API activity or a snapshot.
 *
 * Public RPC history limits vary: try the complete range, then contiguous
 * backwards windows (50,000 down to 1,000 blocks). A 25-second / 64-request
 * overall budget keeps a static page usable. Unscanned history, a reorg, an
 * ownership race, or a failed proof returns null; callers show Unavailable.
 * The pinned head must still be canonical even if ownerOf is unchanged: a
 * transfer away and back, or a self-transfer, also resets acquisition time.
 */
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export async function readAcquisition(tokenId: number, owner: string): Promise<Acquisition | null> {
  if (!Number.isSafeInteger(tokenId) || tokenId < 0 || !/^0x[0-9a-f]{40}$/i.test(owner) || /^0x0{40}$/i.test(owner)) return null;
  const expectedOwner = owner.toLowerCase();
  const tokenTopic = '0x' + encodeUint(tokenId);
  const deadline = Date.now() + ACQUISITION_BUDGET_MS;
  let requests = 0;

  for (const endpoint of LOG_RPC_ENDPOINTS) {
    // Several JSON-RPC calls travel in one HTTP request where they do not
    // depend on each other, which keeps a page load under public rate limits.
    // One HTTP 429 is retried once after a short pause; a second moves on.
    const batch = async (calls: { method: string; params: unknown[] }[]): Promise<unknown[]> => {
      const remaining = deadline - Date.now();
      if (remaining <= 0 || requests >= ACQUISITION_MAX_REQUESTS) throw new Error('Acquisition lookup budget reached');
      requests += 1;
      const base = requests * 16;
      const body = calls.map((call, i) => ({ jsonrpc: '2.0', id: base + i, ...call }));
      let responses: RpcResponse<unknown>[] | RpcResponse<unknown>;
      try {
        responses = await postJson<RpcResponse<unknown>[] | RpcResponse<unknown>>(endpoint, body, Math.min(6_000, remaining));
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 429) || deadline - Date.now() < 3_000) throw error;
        await sleep(1_500);
        requests += 1;
        responses = await postJson<RpcResponse<unknown>[] | RpcResponse<unknown>>(endpoint, body, Math.min(6_000, deadline - Date.now()));
      }
      const list = Array.isArray(responses) ? responses : [responses];
      const byId = new Map(list.map((r) => [r.id, r]));
      return calls.map((_, i) => {
        const r = byId.get(base + i);
        if (r?.error) throw new RpcReadError(r.error.message);
        if (!r || r.result === undefined) throw new Error('Incomplete RPC response');
        return r.result;
      });
    };
    const request = async <T,>(method: string, params: unknown[]): Promise<T> => (await batch([{ method, params }]))[0] as T;
    try {
      const [chainId, headResult] = await batch([
        { method: 'eth_chainId', params: [] },
        { method: 'eth_getBlockByNumber', params: ['latest', false] },
      ]) as [string, RpcBlock | null];
      if (quantity(chainId) !== 1) throw new Error('Not Ethereum mainnet');
      const head = blockData(headResult);
      const headNumber = quantity(head.number);
      const ownerAtHead = await request<string>('eth_call', [
        { to: COLLECTION_ADDRESS, data: SEL.ownerOf + encodeUint(tokenId) }, head.number,
      ]);
      if (!HASH_PATTERN.test(ownerAtHead) || decodeAddress(ownerAtHead).toLowerCase() !== expectedOwner) return null;

      const getLogs = (from: number, to: number) => request<unknown>('eth_getLogs', [{
        address: COLLECTION_ADDRESS,
        topics: [TRANSFER_TOPIC, null, null, tokenTopic],
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + to.toString(16),
      }]);
      let event: TransferLog | null = null;
      try {
        event = latestTransfer(await getLogs(0, headNumber), tokenTopic, 0, headNumber);
        if (!event) return null;
      } catch (error) {
        // A JSON-RPC range rejection can be repaired with smaller windows.
        // Transport errors or invalid proof data instead try the next RPC.
        if (!(error instanceof RpcReadError)) throw error;
        let to = headNumber;
        let span = 50_000;
        let retried = false;
        while (to >= 0 && !event) {
          const from = Math.max(0, to - span + 1);
          try {
            event = latestTransfer(await getLogs(from, to), tokenTopic, from, to);
            to = from - 1;
            retried = false;
          } catch (windowError) {
            if (!(windowError instanceof RpcReadError)) throw windowError;
            // "service temporarily unavailable" is not a range limit: retry the
            // same window once after a pause before shrinking it.
            if (!retried && /unavailable|timeout|timed out|internal|try again/i.test(windowError.message)) {
              retried = true;
              await sleep(1_000);
              continue;
            }
            if (span <= 1_000) throw windowError;
            span = Math.max(1_000, Math.floor(span / 2));
            retried = false;
          }
        }
        if (!event) return null;
      }

      if (decodeAddress(event.topics[2] ?? '').toLowerCase() !== expectedOwner) return null;
      // The final head is read in the same batch, after the proof block and the
      // owner check, so nothing here can observe a state older than the logs.
      const [acquisitionResult, currentOwner, confirmedResult] = await batch([
        { method: 'eth_getBlockByNumber', params: [event.blockNumber, false] },
        { method: 'eth_call', params: [{ to: COLLECTION_ADDRESS, data: SEL.ownerOf + encodeUint(tokenId) }, 'latest'] },
        { method: 'eth_getBlockByNumber', params: ['latest', false] },
      ]) as [RpcBlock | null, string, RpcBlock | null];
      const acquisitionBlock = blockData(acquisitionResult);
      if (acquisitionBlock.hash.toLowerCase() !== event.blockHash.toLowerCase() ||
        quantity(acquisitionBlock.number) !== quantity(event.blockNumber) ||
        !HASH_PATTERN.test(currentOwner) || decodeAddress(currentOwner).toLowerCase() !== expectedOwner) return null;
      // Ethereum produces a block every 12 seconds, so the head often advances
      // during these reads; that is not a failure as long as the pinned head is
      // still canonical and the new blocks contain no Transfer of this token. A
      // reorg (the pinned block hash no longer canonical) or a newer Transfer
      // fails closed.
      const confirmedHead = blockData(confirmedResult);
      const confirmedNumber = quantity(confirmedHead.number);
      let verifiedAtBlock = headNumber;
      if (confirmedHead.hash.toLowerCase() !== head.hash.toLowerCase() || confirmedNumber !== headNumber) {
        if (confirmedNumber <= headNumber) return null;
        const pinned = blockData(await request<RpcBlock | null>('eth_getBlockByNumber', [head.number, false]));
        if (pinned.hash.toLowerCase() !== head.hash.toLowerCase()) return null;
        const newer = latestTransfer(await getLogs(headNumber + 1, confirmedNumber), tokenTopic, headNumber + 1, confirmedNumber);
        if (newer) return null;
        verifiedAtBlock = confirmedNumber;
      }
      const timestamp = quantity(acquisitionBlock.timestamp);
      if (timestamp > quantity(head.timestamp) || timestamp > Date.now() / 1_000 + 60) return null;
      return {
        acquiredAt: new Date(timestamp * 1_000).toISOString(),
        transactionHash: event.transactionHash,
        blockNumber: quantity(event.blockNumber),
        blockHash: event.blockHash,
        owner: expectedOwner,
        verifiedAtBlock,
      };
    } catch {
      // Failure never promotes an incomplete log search to a date estimate.
      if (Date.now() >= deadline || requests >= ACQUISITION_MAX_REQUESTS) break;
    }
  }
  return null;
}

export interface EnsResult {
  name: string | null;
  verified: boolean; // forward resolution of the reverse name points back at the address
}

/** Reverse-resolve an address through the ENS registry, then forward-check it. */
export async function reverseEns(address: string): Promise<EnsResult> {
  const reverseNode = namehash(`${address.toLowerCase().replace(/^0x/, '')}.addr.reverse`);
  const [resolverRaw] = await ethCallBatch([{ to: ENS_REGISTRY, data: SEL.resolver + encodeBytes32(reverseNode) }]);
  const resolver = resolverRaw ? decodeAddress(resolverRaw) : null;
  if (!resolver || /^0x0{40}$/.test(resolver)) return { name: null, verified: false };
  const [nameRaw] = await ethCallBatch([{ to: resolver, data: SEL.name + encodeBytes32(reverseNode) }]);
  const name = nameRaw && nameRaw.length > 130 ? decodeString(nameRaw) : '';
  if (!name) return { name: null, verified: false };
  try {
    const forwardNode = namehash(name);
    const [fwdResolverRaw] = await ethCallBatch([{ to: ENS_REGISTRY, data: SEL.resolver + encodeBytes32(forwardNode) }]);
    const fwdResolver = fwdResolverRaw ? decodeAddress(fwdResolverRaw) : null;
    if (!fwdResolver || /^0x0{40}$/.test(fwdResolver)) return { name, verified: false };
    const [addrRaw] = await ethCallBatch([{ to: fwdResolver, data: SEL.addr + encodeBytes32(forwardNode) }]);
    const resolved = addrRaw ? decodeAddress(addrRaw) : null;
    return { name, verified: resolved?.toLowerCase() === address.toLowerCase() };
  } catch {
    return { name, verified: false };
  }
}
