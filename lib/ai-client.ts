"use client";
import { db, getSettings } from "./db";
import type {
  DetectedItem,
  GapReport,
  ItemTags,
  OutfitSuggestion,
  PairResult,
  RateResult,
  TravelPlan,
} from "./types";
import { summarize } from "./types";

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const s = await getSettings();
  const res = await fetch(`/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ styleProfile: s.styleProfile, presentation: s.presentation, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

async function wardrobe() {
  const items = await db.items.toArray();
  return items.map(summarize);
}

export const ai = {
  tagItem: (image: string, hint?: string) => post<ItemTags>("tag-item", { image, hint }),
  detectItems: (image: string) => post<{ items: DetectedItem[] }>("detect-items", { image }),
  outfit: async (opts: { weather?: string; plans?: string; mood?: string; avoidItemIds?: string[]; recentlyWornIds?: string[]; count?: number }) =>
    post<{ outfits: OutfitSuggestion[] }>("outfit", { items: await wardrobe(), ...opts }),
  ideas: async (prompt: string, anchorItemIds?: string[], count = 3) =>
    post<{ outfits: OutfitSuggestion[] }>("ideas", { items: await wardrobe(), prompt, anchorItemIds, count }),
  rateImage: (image: string, occasion?: string) => post<RateResult>("rate", { image, occasion }),
  rateOutfit: async (outfitItemIds: string[], occasion?: string) =>
    post<RateResult>("rate", { outfitItemIds, items: await wardrobe(), occasion }),
  gaps: async (goals?: string, budget?: string) => post<GapReport>("gaps", { items: await wardrobe(), goals, budget }),
  pair: async (image: string, note?: string) => post<PairResult>("pair", { items: await wardrobe(), image, note }),
  travel: async (opts: { destination: string; days: { date: string; weather: string }[]; activities?: string; luggage?: string }) =>
    post<TravelPlan>("travel", { items: await wardrobe(), ...opts }),
};
