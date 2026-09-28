// Turns an ERC-721 tokenURI into displayable artwork plus a palette derived
// from that specific artwork. IdentityMD tokens are fully onchain: the URI is
// a base64 JSON document whose `image` is a base64 SVG.

export interface Trait {
  trait_type: string;
  value: string;
}

export interface Palette {
  primary: string; // vivid accent used for glow, orbits and highlights
  secondary: string; // second hue for contrast lines
  tertiary: string; // third hue or a lighter tint of primary
  text: string; // primary lifted until it reads as text on the card background (>= 4.5:1)
  fill: string; // primary lifted until dark text reads on it as a button fill (>= 4.5:1)
  raw: string[]; // every vivid color found, most frequent first
}

export interface Artwork {
  name: string;
  description: string;
  image: string; // data: URI or https URL
  traits: Trait[];
  palette: Palette;
  isSvg: boolean;
  svgSource: string | null;
}

const CARD_BG = '#0b0b0f';
const PAGE_BG = '#060608';
export const DEFAULT_PALETTE: Palette = {
  primary: '#22d3ee',
  secondary: '#a78bfa',
  tertiary: '#67e8f9',
  text: '#67e8f9',
  fill: '#22d3ee',
  raw: [],
};

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7).replace(/^ipfs\//, '')}`;
  return uri;
}

export async function loadArtwork(tokenURI: string): Promise<Artwork> {
  let metadataText: string;
  if (tokenURI.startsWith('data:')) {
    const comma = tokenURI.indexOf(',');
    const header = tokenURI.slice(5, comma);
    const payload = tokenURI.slice(comma + 1);
    metadataText = header.includes('base64') ? decodeBase64Utf8(payload) : decodeURIComponent(payload);
  } else {
    const res = await fetch(ipfsToHttp(tokenURI));
    if (!res.ok) throw new Error(`metadata HTTP ${res.status}`);
    metadataText = await res.text();
  }
  const meta = JSON.parse(metadataText) as {
    name?: string;
    description?: string;
    image?: string;
    image_data?: string;
    attributes?: Trait[];
  };
  let image = meta.image ?? '';
  let svgSource: string | null = null;
  if (!image && meta.image_data) {
    svgSource = meta.image_data;
    image = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgSource)))}`;
  }
  const isSvg = image.startsWith('data:image/svg+xml') || /\.svg(\?|$)/i.test(image);
  if (image.startsWith('data:image/svg+xml')) {
    const comma = image.indexOf(',');
    const header = image.slice(5, comma);
    const payload = image.slice(comma + 1);
    try {
      svgSource = header.includes('base64') ? decodeBase64Utf8(payload) : decodeURIComponent(payload);
    } catch {
      svgSource = null;
    }
  }
  image = ipfsToHttp(image);
  const traits = Array.isArray(meta.attributes)
    ? meta.attributes
        .filter((t) => t && typeof t.trait_type === 'string')
        .map((t) => ({ trait_type: t.trait_type, value: String(t.value) }))
    : [];
  const palette = svgSource ? paletteFromSvg(svgSource) : await paletteFromImage(image);
  return {
    name: meta.name ?? '',
    description: meta.description ?? '',
    image,
    traits,
    palette,
    isSvg,
    svgSource,
  };
}

// ---- colour maths -----------------------------------------------------------

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [h * 60, s, l];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Mix `hex` toward white until it reaches `target` contrast on `bg`. */
export function liftForContrast(hex: string, bg = CARD_BG, target = 4.5): string {
  let [r, g, b] = hexToRgb(hex);
  let out = rgbToHex(r, g, b);
  let guard = 0;
  while (contrastRatio(out, bg) < target && guard < 40) {
    r += (255 - r) * 0.12;
    g += (255 - g) * 0.12;
    b += (255 - b) * 0.12;
    out = rgbToHex(r, g, b);
    guard += 1;
  }
  return out;
}

function isVivid(hex: string): boolean {
  const [, s, l] = rgbToHsl(...hexToRgb(hex));
  return s >= 0.45 && l >= 0.28 && l <= 0.8;
}

function hueDistance(a: string, b: string): number {
  const ha = rgbToHsl(...hexToRgb(a))[0];
  const hb = rgbToHsl(...hexToRgb(b))[0];
  const d = Math.abs(ha - hb);
  return Math.min(d, 360 - d);
}

function buildPalette(ranked: string[]): Palette {
  const vivid = ranked.filter(isVivid);
  if (vivid.length === 0) return DEFAULT_PALETTE;
  const primary = vivid[0] as string;
  const secondary = vivid.find((c) => hueDistance(c, primary) >= 40) ?? vivid[1] ?? primary;
  const tertiary =
    vivid.find((c) => c !== primary && c !== secondary && hueDistance(c, primary) >= 25 && hueDistance(c, secondary) >= 25) ??
    liftForContrast(primary, CARD_BG, 7);
  return {
    primary,
    secondary,
    tertiary,
    text: liftForContrast(primary, CARD_BG, 4.5),
    fill: liftForContrast(primary, PAGE_BG, 4.6),
    raw: vivid,
  };
}

/** Count colour literals in SVG source, weighted so strokes and fills beat tiny stops. */
export function paletteFromSvg(svg: string): Palette {
  const counts = new Map<string, number>();
  const add = (hex: string, weight: number) => {
    const key = hex.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + weight);
  };
  const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  for (const m of svg.matchAll(hexRe)) {
    const hex = '#' + (m[1] as string);
    const norm = rgbToHex(...hexToRgb(hex));
    add(norm, 1);
  }
  // Emphasise colours used as stroke/fill on shapes (the visible geometry).
  const attrRe = /(stroke|fill|stop-color|flood-color)="(#[0-9a-f]{3,6})"/gi;
  for (const m of svg.matchAll(attrRe)) {
    const norm = rgbToHex(...hexToRgb(m[2] as string));
    add(norm, m[1] === 'stroke' ? 3 : 2);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  return buildPalette(ranked);
}

/** Fallback for raster artwork: quantise a small downscale and rank buckets. */
export async function paletteFromImage(src: string): Promise<Palette> {
  try {
    const img = await loadImage(src);
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return DEFAULT_PALETTE;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] ?? 0) < 128) continue;
      const r = Math.round((data[i] ?? 0) / 32) * 32;
      const g = Math.round((data[i + 1] ?? 0) / 32) * 32;
      const b = Math.round((data[i + 2] ?? 0) / 32) * 32;
      const hex = rgbToHex(r, g, b);
      buckets.set(hex, (buckets.get(hex) ?? 0) + 1);
    }
    const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
    return buildPalette(ranked);
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}
