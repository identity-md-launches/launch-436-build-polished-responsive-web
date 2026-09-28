// Public, read-only data sources. Nothing here needs a wallet, a key or a
// signature; every endpoint is a GET (or a JSON-RPC eth_call).

export const OFFICIAL_API_BASE = 'https://api.imd.fun';
export const OFFICIAL_EXPLORER_BASE = 'https://explorer.imd.fun';

// Browser-safe JSON-RPC endpoints (they answer with Access-Control-Allow-Origin: *).
export const RPC_ENDPOINTS = [
  'https://ethereum-rpc.publicnode.com',
  'https://cloudflare-eth.com',
  'https://eth.llamarpc.com',
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

// Optional operator overrides. A site owner who fronts the official API with a
// CORS-enabled proxy can point the app at it without rebuilding.
const STORAGE_API = 'simcard:apiBase';
const STORAGE_EXPLORER = 'simcard:explorerBase';

function readOverride(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value && /^https?:\/\//.test(value) ? value.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export function getApiBase(): string {
  return readOverride(STORAGE_API) ?? OFFICIAL_API_BASE;
}

export function getExplorerBase(): string {
  return readOverride(STORAGE_EXPLORER) ?? OFFICIAL_EXPLORER_BASE;
}

export function setOverrides(apiBase: string, explorerBase: string): void {
  try {
    if (apiBase.trim()) window.localStorage.setItem(STORAGE_API, apiBase.trim());
    else window.localStorage.removeItem(STORAGE_API);
    if (explorerBase.trim()) window.localStorage.setItem(STORAGE_EXPLORER, explorerBase.trim());
    else window.localStorage.removeItem(STORAGE_EXPLORER);
  } catch {
    // Storage may be unavailable (private mode); overrides are optional.
  }
}

export function getOverrides(): { apiBase: string; explorerBase: string } {
  return { apiBase: readOverride(STORAGE_API) ?? '', explorerBase: readOverride(STORAGE_EXPLORER) ?? '' };
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
  apiSeat: (tokenId: number) => `${OFFICIAL_API_BASE}/seats/${tokenId}`,
  apiStanding: (tokenId: number) => `${OFFICIAL_API_BASE}/seats/${tokenId}/standing`,
  apiEarnings: (address: string) => `${OFFICIAL_API_BASE}/wallets/${address}/earnings`,
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
