"use client";
import type { Item, LayoutSlot } from "./types";

export async function fileToImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Could not decode image"));
      img.src = url;
    });
    return img;
  } finally {
    // revoke after decode completes on next tick
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality = 0.92): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, quality));
}

/** Resize so the longest side is <= max. Returns a blob of given type. */
export async function resizeBlob(file: Blob, max = 1024, type = "image/jpeg", quality = 0.86): Promise<Blob> {
  const img = await fileToImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToBlob(c, type, quality);
}

export async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });
}

/** Trim transparent margins of a PNG so items sit tight in collages */
export async function trimTransparent(blob: Blob, pad = 8): Promise<Blob> {
  const img = await fileToImage(blob);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return blob;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return canvasToBlob(out, "image/png");
}

/**
 * Remove the background using an on-device model (no server, no cost).
 * Falls back to the original image if the model fails to load (e.g. offline).
 */
export async function removeBackgroundSafe(
  blob: Blob,
  onProgress?: (pct: number) => void
): Promise<{ blob: Blob; removed: boolean }> {
  try {
    const mod = await import("@imgly/background-removal");
    const out = await mod.removeBackground(blob, {
      model: "isnet_quint8",
      output: { format: "image/png", quality: 0.9 },
      progress: (_key: string, current: number, total: number) => {
        if (onProgress && total) onProgress(Math.round((current / total) * 100));
      },
    });
    const trimmed = await trimTransparent(out);
    return { blob: trimmed, removed: true };
  } catch (e) {
    console.warn("Background removal unavailable, keeping original", e);
    return { blob: await resizeBlob(blob, 1024, "image/png"), removed: false };
  }
}

/** Crop a region given in 0..1000 normalized coordinates */
export async function cropNormalized(blob: Blob, box: [number, number, number, number], padFrac = 0.04): Promise<Blob> {
  const img = await fileToImage(blob);
  const W = img.naturalWidth, H = img.naturalHeight;
  let [x1, y1, x2, y2] = box.map((v) => Math.max(0, Math.min(1000, v)) / 1000);
  const pw = (x2 - x1) * padFrac, ph = (y2 - y1) * padFrac;
  x1 = Math.max(0, x1 - pw); y1 = Math.max(0, y1 - ph);
  x2 = Math.min(1, x2 + pw); y2 = Math.min(1, y2 + ph);
  const sx = x1 * W, sy = y1 * H, sw = Math.max(8, (x2 - x1) * W), sh = Math.max(8, (y2 - y1) * H);
  const c = document.createElement("canvas");
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return canvasToBlob(c, "image/png");
}

export async function makeThumb(blob: Blob, size = 320): Promise<Blob> {
  return resizeBlob(blob, size, "image/png");
}

/** Default flat-lay slot positions by category (fractions of a square canvas) */
export function defaultLayout(items: Item[]): LayoutSlot[] {
  const slots: Record<string, { x: number; y: number; scale: number }> = {
    outerwear: { x: 0.22, y: 0.3, scale: 1.15 },
    tops: { x: 0.5, y: 0.26, scale: 1 },
    dresses: { x: 0.5, y: 0.42, scale: 1.4 },
    bottoms: { x: 0.5, y: 0.66, scale: 1.05 },
    shoes: { x: 0.8, y: 0.82, scale: 0.7 },
    bags: { x: 0.82, y: 0.42, scale: 0.65 },
    accessories: { x: 0.18, y: 0.76, scale: 0.5 },
    other: { x: 0.8, y: 0.2, scale: 0.6 },
  };
  const used: Record<string, number> = {};
  return items.map((it, i) => {
    const base = slots[it.category] ?? slots.other;
    const n = used[it.category] ?? 0;
    used[it.category] = n + 1;
    return {
      itemId: it.id,
      x: Math.min(0.92, base.x + n * 0.12),
      y: Math.min(0.92, base.y + n * 0.1),
      scale: base.scale,
      z: i,
    };
  });
}

/** Render an outfit to a shareable square PNG */
export async function renderOutfitImage(
  items: Item[],
  layout: LayoutSlot[] | undefined,
  opts: { size?: number; title?: string; subtitle?: string; bg?: string } = {}
): Promise<Blob> {
  const size = opts.size ?? 1080;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = opts.bg ?? "#f6f4ef";
  ctx.fillRect(0, 0, size, size);
  const lay = layout && layout.length ? layout : defaultLayout(items);
  const byId = new Map(items.map((i) => [i.id, i]));
  const base = size * 0.34;
  const sorted = [...lay].sort((a, b) => a.z - b.z);
  for (const s of sorted) {
    const it = byId.get(s.itemId);
    if (!it) continue;
    const img = await fileToImage(it.image);
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = base * s.scale, h = w / ratio;
    if (h > base * s.scale * 1.4) { h = base * s.scale * 1.4; w = h * ratio; }
    ctx.drawImage(img, s.x * size - w / 2, s.y * size - h / 2, w, h);
  }
  if (opts.title) {
    ctx.fillStyle = "#0f0f12";
    ctx.font = `600 ${Math.round(size * 0.04)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(opts.title, size * 0.05, size * 0.95);
  }
  if (opts.subtitle) {
    ctx.fillStyle = "#6b6b74";
    ctx.font = `${Math.round(size * 0.026)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(opts.subtitle, size * 0.05, size * 0.985);
  }
  return canvasToBlob(c, "image/png");
}

export async function shareOrDownload(blob: Blob, filename: string, text?: string) {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return;
    } catch {
      /* user cancelled or unsupported; fall through */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
