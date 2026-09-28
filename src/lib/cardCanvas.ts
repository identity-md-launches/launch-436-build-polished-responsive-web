// Canvas renderer for PNG and video export. Draws the same CardModel the DOM
// card shows, at a fixed 1600×1000 layout. `t` in [0,1) drives the loop.

import QRCode from 'qrcode';
import { hexToRgb, loadImage } from '../data/artwork';
import type { CardModel } from './cardModel';

export const CANVAS_W = 1600;
export const CANVAS_H = 1000;
const FONT = '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface CardAssets {
  art: HTMLImageElement | null;
  qr: HTMLCanvasElement;
}

export async function loadCardAssets(model: CardModel): Promise<CardAssets> {
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, model.shareUrl, {
    margin: 1,
    width: 200,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b0b0fff', light: '#ffffffff' },
  });
  let art: HTMLImageElement | null = null;
  if (model.image) {
    try {
      art = await loadImage(model.image);
    } catch {
      art = null;
    }
  }
  try {
    await Promise.all([
      document.fonts.load(`700 96px ${FONT}`),
      document.fonts.load(`500 30px ${FONT}`),
      document.fonts.load(`400 20px ${FONT}`),
    ]);
  } catch {
    // Fall back to the system monospace stack.
  }
  return { art, qr };
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function stateColor(state: CardModel['state']): string {
  switch (state) {
    case 'working':
      return '#fbbf24';
    case 'ready':
    case 'online':
      return '#4ade80';
    case 'offline':
      return '#6b6b78';
    default:
      return '#9a9aa6';
  }
}

/** Loop multipliers per state: full turns of the orbit per clip, pulses, scans. */
export function loopCycles(state: CardModel['state']): { orbit: number; pulse: number; scan: number; dim: number } {
  switch (state) {
    case 'working':
      return { orbit: 3, pulse: 6, scan: 3, dim: 1 };
    case 'ready':
    case 'online':
      return { orbit: 1, pulse: 2, scan: 1, dim: 1 };
    case 'offline':
      return { orbit: 1, pulse: 1, scan: 1, dim: 0.72 };
    default:
      return { orbit: 1, pulse: 1, scan: 1, dim: 0.85 };
  }
}

export function drawCard(
  ctx: CanvasRenderingContext2D,
  model: CardModel,
  assets: CardAssets,
  t: number,
  { animate = true }: { animate?: boolean } = {},
): void {
  const W = CANVAS_W;
  const H = CANVAS_H;
  const pad = 64;
  const { palette } = model;
  const cycles = loopCycles(model.state);
  const phase = animate ? t : 0;

  // Background -----------------------------------------------------------
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 40);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#15151b');
  bg.addColorStop(0.6, '#0b0b0f');
  bg.addColorStop(1, '#060608');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glowA = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.7);
  glowA.addColorStop(0, rgba(palette.primary, 0.18));
  glowA.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);
  const glowB = ctx.createRadialGradient(W, H, 0, W, H, W * 0.6);
  glowB.addColorStop(0, rgba(palette.secondary, 0.16));
  glowB.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.restore();

  // Artwork ------------------------------------------------------------------
  const artSize = 640;
  const ax = pad;
  const ay = pad;
  ctx.save();
  roundRect(ctx, ax, ay, artSize, artSize, 28);
  ctx.clip();
  ctx.fillStyle = '#060608';
  ctx.fillRect(ax, ay, artSize, artSize);
  if (assets.art) {
    ctx.drawImage(assets.art, ax, ay, artSize, artSize);
  } else {
    ctx.fillStyle = '#9a9aa6';
    ctx.font = `400 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('Artwork unavailable', ax + artSize / 2, ay + artSize / 2);
    ctx.textAlign = 'start';
  }
  // Orbital lines
  const cx = ax + artSize / 2;
  const cy = ay + artSize / 2;
  ctx.lineWidth = 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(phase * cycles.orbit * Math.PI * 2);
  ctx.strokeStyle = rgba(palette.primary, 0.55);
  ctx.beginPath();
  ctx.ellipse(0, 0, artSize * 0.46, artSize * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.secondary, 0.45);
  ctx.beginPath();
  ctx.ellipse(0, 0, artSize * 0.36, artSize * 0.44, Math.PI / 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = palette.tertiary;
  ctx.beginPath();
  ctx.arc(artSize * 0.46, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-phase * cycles.orbit * Math.PI * 2 * 0.625);
  ctx.strokeStyle = rgba(palette.tertiary, 0.35);
  ctx.setLineDash([12, 18]);
  ctx.beginPath();
  ctx.arc(0, 0, artSize * 0.47, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Pulsing centre light
  const pulse = 0.5 + 0.5 * Math.sin(phase * cycles.pulse * Math.PI * 2);
  const pr = artSize * (0.14 + 0.05 * pulse);
  const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
  pg.addColorStop(0, rgba(palette.primary, 0.32 + 0.3 * pulse));
  pg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = pg;
  ctx.fillRect(ax, ay, artSize, artSize);
  // Scan line
  if (animate) {
    const sy = ay + ((phase * cycles.scan) % 1) * (artSize + 60) - 30;
    const sg = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(0.5, rgba(palette.tertiary, 0.4));
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(ax, sy - 30, artSize, 60);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Live indicator
  const dotColor = stateColor(model.state);
  const dotPulse = model.state === 'ready' || model.state === 'online' || model.state === 'working' ? pulse : 0;
  ctx.fillStyle = rgba(dotColor, 0.25 * dotPulse);
  ctx.beginPath();
  ctx.arc(ax + artSize - 34, ay + 34, 12 + 10 * dotPulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(ax + artSize - 34, ay + 34, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  roundRect(ctx, ax + 0.5, ay + 0.5, artSize - 1, artSize - 1, 28);
  ctx.stroke();

  // Under the artwork: verification + chip ----------------------------------
  ctx.fillStyle = model.verified ? palette.text : '#9a9aa6';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(model.verification.toUpperCase(), ax, ay + artSize + 58);
  ctx.fillStyle = '#6b6b78';
  ctx.font = `400 18px ${FONT}`;
  ctx.fillText(`${model.network.toUpperCase()}  ·  LAST ACTIVITY ${model.lastActivity.toUpperCase()}`, ax, ay + artSize + 96);
  // chip glyph
  const chipX = ax;
  const chipY = ay + artSize + 130;
  ctx.strokeStyle = rgba(palette.text, 0.75);
  ctx.lineWidth = 2;
  roundRect(ctx, chipX, chipY, 56, 42, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(chipX + 28, chipY);
  ctx.lineTo(chipX + 28, chipY + 42);
  ctx.moveTo(chipX, chipY + 14);
  ctx.lineTo(chipX + 56, chipY + 14);
  ctx.moveTo(chipX, chipY + 28);
  ctx.lineTo(chipX + 56, chipY + 28);
  ctx.stroke();
  ctx.fillStyle = '#6b6b78';
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText('IDENTITYMD · SIMCARD', chipX + 72, chipY + 28);

  // Text column ---------------------------------------------------------------
  const tx = pad + artSize + 56;
  const tw = W - pad - tx;
  ctx.fillStyle = '#6b6b78';
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText('IDENTITY.MD NFT', tx, pad + 22);
  ctx.fillStyle = palette.text;
  ctx.shadowColor = rgba(palette.primary, 0.5);
  ctx.shadowBlur = 24;
  ctx.font = `700 92px ${FONT}`;
  ctx.fillText(model.number, tx - 4, pad + 110);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9a9aa6';
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText(model.name, tx, pad + 150);

  // Status pill
  ctx.font = `600 18px ${FONT}`;
  const label = model.stateLabel.toUpperCase();
  const pillW = ctx.measureText(label).width + 62;
  const py = pad + 186;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, tx, py, pillW, 40, 20);
  ctx.stroke();
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(tx + 22, py + 20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ececf1';
  ctx.fillText(label, tx + 40, py + 26);

  // Six fields in two columns
  const colW = tw / 2;
  const startY = pad + 280;
  model.fields.forEach((field, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = tx + col * colW;
    const fy = startY + row * 118;
    ctx.fillStyle = '#6b6b78';
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText(field.label.toUpperCase(), fx, fy);
    ctx.fillStyle = field.unavailable ? '#9a9aa6' : '#ececf1';
    ctx.font = `${field.unavailable ? 400 : 600} ${field.value.length > 22 ? 24 : 30}px ${FONT}`;
    let value = field.value;
    while (ctx.measureText(value).width > colW - 24 && value.length > 4) value = value.slice(0, -2) + '…';
    ctx.fillText(value, fx, fy + 40);
  });

  // QR + share url
  const qrSize = 168;
  const qx = W - pad - qrSize;
  const qy = H - pad - qrSize;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qx - 8, qy - 8, qrSize + 16, qrSize + 16, 12);
  ctx.fill();
  ctx.drawImage(assets.qr, qx, qy, qrSize, qrSize);
  ctx.fillStyle = '#6b6b78';
  ctx.font = `400 16px ${FONT}`;
  ctx.textAlign = 'end';
  ctx.fillText('SCAN FOR PUBLIC PROFILE', qx - 24, qy + qrSize - 6);
  ctx.textAlign = 'start';

  // Dim for offline/unknown
  if (cycles.dim < 1) {
    ctx.fillStyle = `rgba(6,6,8,${1 - cycles.dim})`;
    ctx.fillRect(0, 0, W, H);
  }
}
