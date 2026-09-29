// Public, read-only data sources. Nothing here needs a wallet, a key or a
// signature; every endpoint is a GET (or a JSON-RPC eth_call).

export const OFFICIAL_API_BASE = 'https://api.imd.fun';
export const OFFICIAL_EXPLORER_BASE = 'https://explorer.imd.fun';

// Browser-safe JSON-RPC endpoints (they answer with Access-Control-Allow-Origin: *).
// Plain eth_call batches (ownerOf, tokenURI, ENS) go to the fast general
// endpoints first. Transfer history needs eth_getLogs over the whole chain: on
// 2026-09-29 rpc.mevblocker.io served a whole-range query for one token,
// rpc.flashbots.net served 50,000-block windows, and publicnode limited logs to
// recent blocks. Keeping the two lists apart spreads load, because mevblocker
// rate-limits bursts (HTTP 429).
export const RPC_ENDPOINTS = [
  'https://ethereum-rpc.publicnode.com',
  'https://rpc.mevblocker.io',
  'https://rpc.flashbots.net',
  'https://cloudflare-eth.com',
];
export const LOG_RPC_ENDPOINTS = [
  'https://rpc.mevblocker.io',
  'https://rpc.flashbots.net',
  'https://ethereum-rpc.publicnode.com',
];

export const CHAIN_ID = 1;
export const CHAIN_NAME = 'Ethereum Mainnet';
export const COLLECTION_ADDRESS = '0x0000ec93127baa929e58e97dd0095a2bfb38ec1d';
export const ADAPTER_ADDRESS = '0xde152afb7db5373f34876e1499fbd893a82dd336';
export const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
export const MAX_TOKEN_ID = 2000;
export const MIN_TOKEN_ID = 1;

export const CACHE_TTL_MS = 60_000;
export const REQUEST_TIMEOUT_MS = 20_000;
// /swarm is cached server-side for about 10 seconds; polling faster gains nothing.
export const LIVE_REFRESH_MS = 10_000;

// One optional trusted first-party proxy. It forwards /swarm, /seats and
// /wallets to api.imd.fun, and /explorer/* to explorer.imd.fun. No public CORS
// relay is used. /swarm already answers browsers directly, so the official
// origin is always tried for it first.
const STORAGE_API = 'simcard:apiBase';

function readOverride(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_API)?.trim();
    if (!value) return null;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      ? url.toString().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export function getApiBase(): string {
  return readOverride() ?? OFFICIAL_API_BASE;
}

export function getExplorerBase(): string {
  const base = readOverride();
  return base ? `${base}/explorer` : OFFICIAL_EXPLORER_BASE;
}

export function setOverrides(apiBase: string): void {
  try {
    if (apiBase.trim()) window.localStorage.setItem(STORAGE_API, apiBase.trim());
    else window.localStorage.removeItem(STORAGE_API);
    window.localStorage.removeItem('simcard:explorerBase');
  } catch {
    // Storage is optional; the official endpoints remain the default.
  }
}

export function getOverrides(): { apiBase: string } {
  return { apiBase: readOverride() ?? '' };
}

export const LINKS = {
  explorerAgent: (tokenId: number) => `${OFFICIAL_EXPLORER_BASE}/agents/${tokenId}`,
  explorerJob: (jobId: string) => `${OFFICIAL_EXPLORER_BASE}/jobs/${jobId}`,
  explorerLaunches: `${OFFICIAL_EXPLORER_BASE}/launches`,
  etherscanToken: (tokenId: number) => `https://etherscan.io/nft/${COLLECTION_ADDRESS}/${tokenId}`,
  etherscanAddress: (address: string) => `https://etherscan.io/address/${address}`,
  etherscanTx: (chainId: number, tx: string) =>
    chainId === 11155111 ? `https://sepolia.etherscan.io/tx/${tx}` : `https://etherscan.io/tx/${tx}`,
  etherscanTokenAddress: (chainId: number, address: string) =>
    chainId === 11155111 ? `https://sepolia.etherscan.io/token/${address}` : `https://etherscan.io/token/${address}`,
  opensea: (tokenId: number) => `https://opensea.io/assets/ethereum/${COLLECTION_ADDRESS}/${tokenId}`,
  apiSwarm: `${OFFICIAL_API_BASE}/swarm`,
  apiRecords: `${OFFICIAL_API_BASE}/seats/records`,
  apiSeat: (tokenId: number) => `${OFFICIAL_API_BASE}/seats/${tokenId}`,
  apiStanding: (tokenId: number) => `${OFFICIAL_API_BASE}/seats/${tokenId}/standing`,
  apiEarnings: (address: string) => `${OFFICIAL_API_BASE}/wallets/${address}/earnings`,
  explorerApiAgent: (tokenId: number) => `${OFFICIAL_EXPLORER_BASE}/api/agents/${tokenId}`,
};

export function chainLabel(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'Ethereum Mainnet';
    case 11155111:
      return 'Sepolia testnet';
    case 8453:
      return 'Base';
    default:
      return `Chain ${chainId}`;
  }
}
