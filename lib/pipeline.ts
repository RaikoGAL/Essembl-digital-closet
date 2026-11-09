"use client";
import { ai } from "./ai-client";
import { db, getSettings, uid } from "./db";
import { blobToDataUrl, cropNormalized, makeThumb, removeBackgroundSafe, resizeBlob } from "./images";
import type { Item, ItemTags } from "./types";

export interface Draft {
  key: string;
  image: Blob; // processed
  original: Blob; // resized source
  tags: ItemTags;
  bgRemoved: boolean;
}

export type Status = { stage: "resize" | "ai" | "bg" | "crop" | "done"; pct?: number; label: string };

/** One garment per photo: tag with AI and remove background in parallel */
export async function processSinglePhoto(file: Blob, onStatus?: (s: Status) => void, hint?: string): Promise<Draft> {
  const settings = await getSettings();
  onStatus?.({ stage: "resize", label: "Preparing photo…" });
  const resized = await resizeBlob(file, 1024, "image/jpeg", 0.85);
  const dataUrl = await blobToDataUrl(resized);

  onStatus?.({ stage: "ai", label: "Identifying the garment…" });
  const tagP = ai.tagItem(dataUrl, hint);
  const bgP = settings.removeBackground
    ? removeBackgroundSafe(resized, (pct) => onStatus?.({ stage: "bg", pct, label: pct < 100 ? `Removing background… ${pct}%` : "Finishing…" }))
    : Promise.resolve({ blob: await resizeBlob(resized, 1024, "image/png"), removed: false });

  const [tags, bg] = await Promise.all([tagP, bgP]);
  onStatus?.({ stage: "done", label: "Done" });
  return { key: uid(), image: bg.blob, original: resized, tags, bgRemoved: bg.removed };
}

/** Several garments in one photo (outfit selfie / flat lay): detect, crop each, remove bg */
export async function processMultiPhoto(file: Blob, onStatus?: (s: Status) => void): Promise<Draft[]> {
  const settings = await getSettings();
  onStatus?.({ stage: "resize", label: "Preparing photo…" });
  const resized = await resizeBlob(file, 1280, "image/jpeg", 0.85);
  const dataUrl = await blobToDataUrl(resized);
  onStatus?.({ stage: "ai", label: "Detecting items…" });
  const { items } = await ai.detectItems(dataUrl);
  const drafts: Draft[] = [];
  for (let i = 0; i < items.length; i++) {
    const d = items[i];
    onStatus?.({ stage: "crop", label: `Cutting out ${d.tags.name} (${i + 1}/${items.length})…` });
    const crop = await cropNormalized(resized, d.box);
    const bg = settings.removeBackground ? await removeBackgroundSafe(crop) : { blob: crop, removed: false };
    drafts.push({ key: uid(), image: bg.blob, original: crop, tags: d.tags, bgRemoved: bg.removed });
  }
  onStatus?.({ stage: "done", label: "Done" });
  return drafts;
}

export async function saveDraft(d: Draft, source: Item["source"]): Promise<string> {
  const id = uid();
  const thumb = await makeThumb(d.image, 320);
  const item: Item = {
    id,
    createdAt: Date.now(),
    image: d.image,
    thumb,
    name: d.tags.name,
    category: d.tags.category,
    subcategory: d.tags.subcategory,
    colors: d.tags.colors,
    primaryColor: d.tags.primaryColor,
    pattern: d.tags.pattern,
    material: d.tags.material,
    seasons: d.tags.seasons,
    formality: d.tags.formality,
    styleTags: d.tags.styleTags,
    description: d.tags.description,
    brand: d.tags.brand || undefined,
    favorite: false,
    wearCount: 0,
    source,
  };
  await db.items.add(item);
  return id;
}
