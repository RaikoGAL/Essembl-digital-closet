"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, markWorn, todayKey, uid } from "@/lib/db";
import { renderOutfitImage, shareOrDownload } from "@/lib/images";
import type { Item, LayoutSlot, Outfit, OutfitSuggestion } from "@/lib/types";
import { OutfitCollage } from "./OutfitCollage";
import { Button, Card, ScoreRing } from "./ui";

export function useItemsById(ids: string[]): Item[] {
  const items = useLiveQuery(() => db.items.where("id").anyOf(ids).toArray(), [ids.join(",")]);
  const order = new Map(ids.map((id, i) => [id, i]));
  return (items ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function OutfitCard({
  suggestion,
  saved,
  source,
  layout,
  weather,
  forDate,
  onSaved,
  compact,
  extraActions,
}: {
  suggestion: OutfitSuggestion;
  /** If already persisted, pass the saved outfit so actions update it */
  saved?: Outfit | null;
  source: Outfit["source"];
  layout?: LayoutSlot[];
  weather?: Outfit["weather"];
  forDate?: string;
  onSaved?: (o: Outfit) => void;
  compact?: boolean;
  extraActions?: React.ReactNode;
}) {
  const items = useItemsById(suggestion.itemIds);
  const [busy, setBusy] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState<Outfit | null>(saved ?? null);
  const current = saved ?? localSaved;
  const wornToday = current?.wornDates?.includes(todayKey());

  const save = async (): Promise<Outfit> => {
    if (current) return current;
    const o: Outfit = {
      id: uid(),
      createdAt: Date.now(),
      name: suggestion.name,
      itemIds: suggestion.itemIds,
      layout,
      occasion: suggestion.occasion,
      explanation: suggestion.explanation,
      score: suggestion.score,
      source,
      forDate,
      wornDates: [],
      weather,
    };
    await db.outfits.add(o);
    setLocalSaved(o);
    onSaved?.(o);
    return o;
  };

  const wear = async () => {
    setBusy("wear");
    const o = await save();
    await markWorn(o);
    setLocalSaved({ ...o, wornDates: [...(o.wornDates ?? []), todayKey()] });
    setBusy(null);
  };

  const share = async () => {
    setBusy("share");
    try {
      const blob = await renderOutfitImage(items, layout, { title: suggestion.name, subtitle: suggestion.occasion });
      await shareOrDownload(blob, `${suggestion.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, `${suggestion.name} — ${suggestion.explanation}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <OutfitCollage items={items} layout={layout} className="rounded-none" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight">{suggestion.name}</h3>
            {suggestion.occasion && <p className="text-xs text-muted mt-0.5">{suggestion.occasion}</p>}
          </div>
          {typeof suggestion.score === "number" && <ScoreRing score={suggestion.score} size={56} />}
        </div>
        {!compact && <p className="text-sm text-paper/85 mt-3 leading-relaxed">{suggestion.explanation}</p>}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {items.map((i) => (
            <span key={i.id} className="text-[11px] px-2 py-0.5 rounded-full bg-line text-paper/80">{i.name}</span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Button variant={wornToday ? "ghost" : "primary"} size="sm" onClick={wear} loading={busy === "wear"} disabled={!!wornToday}>
            {wornToday ? "✓ Worn" : "Wear it"}
          </Button>
          <Button variant="ghost" size="sm" onClick={async () => { setBusy("save"); await save(); setBusy(null); }} loading={busy === "save"} disabled={!!current}>
            {current ? "✓ Saved" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={share} loading={busy === "share"}>
            Share
          </Button>
        </div>
        {extraActions}
      </div>
    </Card>
  );
}
