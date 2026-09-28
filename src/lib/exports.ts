// PNG and video export plus the X share intent. Everything runs in the
// browser; nothing is uploaded anywhere.

import { CANVAS_H, CANVAS_W, drawCard, loadCardAssets } from './cardCanvas';
import type { CardModel } from './cardModel';

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
  return { canvas, ctx };
}

export async function exportPng(model: CardModel): Promise<void> {
  const assets = await loadCardAssets(model);
  const { canvas, ctx } = makeCanvas(CANVAS_W, CANVAS_H);
  drawCard(ctx, model, assets, 0.18, { animate: true });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Unable to encode the PNG.');
  download(blob, `simcard-${model.tokenId}.png`);
}

export interface VideoOptions {
  durationMs?: number;
  fps?: number;
  onProgress?: (fraction: number) => void;
}

export function pickVideoMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/**
 * Records one seamless loop of the animated card. The loop length is fixed so
 * every cycle count in `loopCycles` lands on a whole number at the end.
 */
export async function exportVideo(model: CardModel, { durationMs = 6000, fps = 30, onProgress }: VideoOptions = {}): Promise<string> {
  const mime = pickVideoMime();
  if (!mime) throw new Error('This browser cannot record video. Use Chrome, Edge or Firefox, or download the PNG instead.');
  const assets = await loadCardAssets(model);
  const { canvas, ctx } = makeCanvas(1280, 800);
  ctx.scale(1280 / CANVAS_W, 800 / CANVAS_H);
  drawCard(ctx, model, assets, 0);

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));
    recorder.onerror = () => reject(new Error('Video recording failed.'));
  });
  recorder.start(250);

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const elapsed = now - start;
      const t = (elapsed % durationMs) / durationMs;
      drawCard(ctx, model, assets, t);
      onProgress?.(Math.min(1, elapsed / durationMs));
      if (elapsed >= durationMs) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  const blob = await done;
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  download(blob, `simcard-${model.tokenId}.${ext}`);
  return ext;
}

export function shareCaption(model: CardModel): string {
  const accepted = model.fields.find((f) => f.label === 'Accepted');
  const rate = model.fields.find((f) => f.label === 'Acceptance');
  const stats =
    accepted && !accepted.unavailable && rate && !rate.unavailable
      ? ` ${accepted.value} accepted jobs at ${rate.value} acceptance.`
      : '';
  return `SIMCARD for identity.md ${model.number} on the IdentityMD swarm.${stats} Live status, work stats and onchain proof:`;
}

export function xIntentUrl(model: CardModel): string {
  const params = new URLSearchParams({ text: shareCaption(model), url: model.shareUrl });
  return `https://x.com/intent/post?${params.toString()}`;
}
