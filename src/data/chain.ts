// Read-only Ethereum access with hand-rolled ABI encoding. Only `eth_call` is
// ever sent; there is no signer, no wallet provider and no transaction path.

import { keccak_256 } from '@noble/hashes/sha3';
import { COLLECTION_ADDRESS, ENS_REGISTRY, RPC_ENDPOINTS } from './config';
import { HttpError, postJson } from './http';

type RpcResponse = { id: number; result?: string; error?: { code: number; message: string } };

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
}

/** Batched eth_call against the first browser-safe RPC that answers. */
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
      return calls.map((_, i) => {
        const r = byId.get(i + 1);
        return r && typeof r.result === 'string' ? r.result : null;
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
    { to: COLLECTION_ADDRESS, data: SEL.ownerOf + id },
    { to: COLLECTION_ADDRESS, data: SEL.tokenURI + id },
    { to: COLLECTION_ADDRESS, data: SEL.hasIdentityHash + id },
    { to: COLLECTION_ADDRESS, data: SEL.identityHash + id },
    { to: COLLECTION_ADDRESS, data: SEL.identityHashLocked + id },
    { to: COLLECTION_ADDRESS, data: SEL.totalSupply },
  ]);
  const [owner, uri, hasHash, hash, locked, supply] = results;
  const ownerAddress = owner && owner.length >= 66 ? decodeAddress(owner) : null;
  return {
    owner: ownerAddress && ownerAddress !== '0x0000000000000000000000000000000000000000' ? ownerAddress : null,
    tokenURI: uri && uri.length > 130 ? decodeString(uri) : null,
    hasIdentityHash: hasHash ? decodeBool(hasHash) : null,
    identityHash: hash && hash.length > 130 ? decodeString(hash) : null,
    identityHashLocked: locked ? decodeBool(locked) : null,
    totalSupply: supply ? Number(decodeUint(supply)) : null,
  };
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
