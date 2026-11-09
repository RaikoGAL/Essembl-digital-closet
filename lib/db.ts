"use client";
import Dexie, { type EntityTable } from "dexie";
import type { Folder, Item, Outfit, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

class ClosetDB extends Dexie {
  items!: EntityTable<Item, "id">;
  outfits!: EntityTable<Outfit, "id">;
  folders!: EntityTable<Folder, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("digital-closet");
    this.version(1).stores({
      items: "id, createdAt, category, favorite, wearCount, lastWorn",
      outfits: "id, createdAt, source, forDate, folderId",
      folders: "id, createdAt",
      settings: "id",
    });
  }
}

export const db = new ClosetDB();

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get("main");
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch, id: "main" as const };
  await db.settings.put(next);
  return next;
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function markWorn(outfit: Outfit, date = todayKey()) {
  const worn = Array.from(new Set([...(outfit.wornDates ?? []), date]));
  await db.outfits.update(outfit.id, { wornDates: worn });
  const now = Date.now();
  await Promise.all(
    outfit.itemIds.map(async (id) => {
      const it = await db.items.get(id);
      if (it) await db.items.update(id, { wearCount: (it.wearCount ?? 0) + 1, lastWorn: now });
    })
  );
}

/** Export everything (images as base64) for backup */
export async function exportBackup(): Promise<Blob> {
  const [items, outfits, folders, settings] = await Promise.all([
    db.items.toArray(),
    db.outfits.toArray(),
    db.folders.toArray(),
    db.settings.toArray(),
  ]);
  const toB64 = (b: Blob) =>
    new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(b);
    });
  const itemsOut = await Promise.all(
    items.map(async (it) => ({ ...it, image: await toB64(it.image), thumb: await toB64(it.thumb) }))
  );
  const json = JSON.stringify({ version: 1, exportedAt: Date.now(), items: itemsOut, outfits, folders, settings });
  return new Blob([json], { type: "application/json" });
}

export async function importBackup(file: Blob): Promise<number> {
  const text = await file.text();
  const data = JSON.parse(text);
  const fromB64 = async (s: string) => (await fetch(s)).blob();
  const items: Item[] = await Promise.all(
    (data.items ?? []).map(async (it: Item & { image: string; thumb: string }) => ({
      ...it,
      image: await fromB64(it.image),
      thumb: await fromB64(it.thumb),
    }))
  );
  await db.transaction("rw", db.items, db.outfits, db.folders, db.settings, async () => {
    await db.items.bulkPut(items);
    await db.outfits.bulkPut(data.outfits ?? []);
    await db.folders.bulkPut(data.folders ?? []);
    if (data.settings?.length) await db.settings.bulkPut(data.settings);
  });
  return items.length;
}
