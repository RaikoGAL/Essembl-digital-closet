"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ItemThumb } from "@/components/ItemThumb";
import { OutfitCard } from "@/components/OutfitCard";
import { OutfitCollage } from "@/components/OutfitCollage";
import { Button, Card, Chip, ErrorBanner, PageHeader, ScoreRing, Sheet, inputCls } from "@/components/ui";
import { ai } from "@/lib/ai-client";
import { db, uid } from "@/lib/db";
import { defaultLayout, renderOutfitImage, shareOrDownload } from "@/lib/images";
import { CATEGORIES, type Category, type Item, type LayoutSlot, type OutfitSuggestion, type RateResult } from "@/lib/types";

const IDEA_CHIPS = ["Date night", "Office day", "Weekend brunch", "Night out", "Rainy day", "Job interview", "Travel day", "Gym to coffee", "Wedding guest", "Cozy at home"];

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted">Loading…</div>}>
      <Studio />
    </Suspense>
  );
}

function Studio() {
  const params = useSearchParams();
  const router = useRouter();
  const items = useLiveQuery(() => db.items.toArray(), []);
  const [mode, setMode] = useState<"build" | "ideas">(params.get("ideas") ? "ideas" : "build");

  // ----- Build state -----
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<LayoutSlot[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [cat, setCat] = useState<Category | "all">("all");
  const [editingOutfitId, setEditingOutfitId] = useState<string | null>(null);
  const [rate, setRate] = useState<RateResult | null>(null);
  const [rating, setRating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveOccasion, setSaveOccasion] = useState("");
  const [busy, setBusy] = useState(false);

  // ----- Ideas state -----
  const [prompt, setPrompt] = useState("");
  const [anchor, setAnchor] = useState<string | null>(params.get("anchor"));
  const [ideas, setIdeas] = useState<OutfitSuggestion[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  // Load from params once
  useEffect(() => {
    const a = params.get("anchor");
    const o = params.get("outfit");
    if (o) {
      db.outfits.get(o).then((of) => {
        if (!of) return;
        setSelected(of.itemIds);
        setLayout(of.layout ?? []);
        setEditingOutfitId(of.id);
        setSaveName(of.name);
        setSaveOccasion(of.occasion ?? "");
      });
    } else if (a && !params.get("ideas")) {
      setSelected([a]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItems = useMemo(() => {
    const map = new Map((items ?? []).map((i) => [i.id, i]));
    return selected.map((id) => map.get(id)).filter(Boolean) as Item[];
  }, [items, selected]);

  const toggle = (id: string) => {
    setRate(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setLayout((l) => l.filter((s) => s.itemId !== id));
  };

  const tray = (items ?? []).filter((i) => cat === "all" || i.category === cat);
  const activeSlot = layout.find((s) => s.itemId === active) ?? (active ? defaultLayout(selectedItems).find((s) => s.itemId === active) : undefined);

  const patchActive = (p: Partial<LayoutSlot>) => {
    if (!active) return;
    const full = layout.length ? layout : defaultLayout(selectedItems);
    const ids = new Set(full.map((s) => s.itemId));
    const merged = [...full, ...defaultLayout(selectedItems).filter((s) => !ids.has(s.itemId))];
    setLayout(merged.map((s) => (s.itemId === active ? { ...s, ...p } : s)));
  };

  const doRate = async () => {
    setRating(true);
    setError(null);
    try {
      setRate(await ai.rateOutfit(selected, saveOccasion || undefined));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRating(false);
    }
  };

  const applySwap = (s: RateResult["swaps"][number]) => {
    setSelected((sel) => {
      let next = sel;
      if (s.removeItemId) next = next.filter((x) => x !== s.removeItemId);
      if (s.addItemId && !next.includes(s.addItemId)) next = [...next, s.addItemId];
      return next;
    });
    setLayout((l) => l.filter((x) => x.itemId !== s.removeItemId));
    setRate(null);
  };

  const save = async () => {
    setBusy(true);
    const name = saveName.trim() || `Studio look ${new Date().toLocaleDateString()}`;
    if (editingOutfitId) {
      await db.outfits.update(editingOutfitId, { name, itemIds: selected, layout, occasion: saveOccasion || undefined, score: rate?.score });
      router.push(`/outfits/${editingOutfitId}`);
    } else {
      const id = uid();
      await db.outfits.add({ id, createdAt: Date.now(), name, itemIds: selected, layout, occasion: saveOccasion || undefined, score: rate?.score, explanation: rate?.headline, source: "studio", wornDates: [] });
      router.push(`/outfits/${id}`);
    }
    setBusy(false);
  };

  const generateIdeas = async (p?: string) => {
    const text = (p ?? prompt).trim();
    if (!text) return;
    setPrompt(text);
    setIdeasLoading(true);
    setError(null);
    try {
      const res = await ai.ideas(text, anchor ? [anchor] : undefined, 3);
      setIdeas(res.outfits);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIdeasLoading(false);
    }
  };

  const anchorItem = (items ?? []).find((i) => i.id === anchor);

  return (
    <div>
      <PageHeader title="Studio" subtitle={mode === "build" ? "Build a look and get it scored" : "Ask for outfit ideas from your closet"} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 bg-card rounded-full p-1">
          <button onClick={() => setMode("build")} className={`py-2 rounded-full text-sm font-medium ${mode === "build" ? "bg-paper text-ink" : "text-muted"}`}>Build</button>
          <button onClick={() => setMode("ideas")} className={`py-2 rounded-full text-sm font-medium ${mode === "ideas" ? "bg-paper text-ink" : "text-muted"}`}>Get ideas</button>
        </div>
      </div>

      <ErrorBanner error={error} />

      {mode === "build" ? (
        <>
          <div className="px-4 mt-4">
            <OutfitCollage items={selectedItems} layout={layout.length ? layout : undefined} editable onLayoutChange={setLayout} selectedId={active} onSelect={setActive} />
            {active && activeSlot && (
              <div className="mt-2 flex items-center gap-2 justify-center">
                <Button size="sm" variant="ghost" onClick={() => patchActive({ scale: Math.max(0.3, activeSlot.scale - 0.1) })}>−</Button>
                <span className="text-xs text-muted w-16 text-center">{Math.round(activeSlot.scale * 100)}%</span>
                <Button size="sm" variant="ghost" onClick={() => patchActive({ scale: Math.min(2.2, activeSlot.scale + 0.1) })}>+</Button>
                <Button size="sm" variant="ghost" onClick={() => patchActive({ z: Math.max(...layout.map((s) => s.z), selectedItems.length) + 1 })}>To front</Button>
                <Button size="sm" variant="danger" onClick={() => { toggle(active); setActive(null); }}>Remove</Button>
              </div>
            )}
          </div>

          {rate && (
            <Card className="mx-4 mt-4 p-4">
              <div className="flex items-center gap-4">
                <ScoreRing score={rate.score} size={72} label="score" />
                <div className="flex-1">
                  <p className="font-semibold leading-snug">{rate.headline}</p>
                </div>
              </div>
              {rate.strengths.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {rate.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2"><span>✅</span><span>{s}</span></li>
                  ))}
                </ul>
              )}
              {rate.improvements.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {rate.improvements.map((s, i) => (
                    <li key={i} className="flex gap-2"><span>💡</span><span>{s}</span></li>
                  ))}
                </ul>
              )}
              {rate.swaps.filter((s) => s.addItemId || s.removeItemId).length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted uppercase tracking-wide">Try a swap</p>
                  {rate.swaps.filter((s) => s.addItemId || s.removeItemId).map((s, i) => (
                    <SwapRow key={i} swap={s} items={items ?? []} onApply={() => applySwap(s)} />
                  ))}
                </div>
              )}
            </Card>
          )}

          <div className="px-4 mt-4 grid grid-cols-3 gap-2">
            <Button onClick={doRate} loading={rating} disabled={selected.length < 2}>⭐ Rate me</Button>
            <Button variant="ghost" onClick={() => setSaveOpen(true)} disabled={selected.length < 2}>{editingOutfitId ? "Update" : "Save"}</Button>
            <Button
              variant="ghost"
              disabled={selected.length < 1}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const b = await renderOutfitImage(selectedItems, layout.length ? layout : undefined, { title: saveName || "My look" });
                await shareOrDownload(b, "look.png");
                setBusy(false);
              }}
            >
              Share
            </Button>
          </div>

          <div className="mt-5 border-t border-line pt-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2">
              <Chip active={cat === "all"} onClick={() => setCat("all")}>All</Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
              ))}
            </div>
            {items && items.length === 0 ? (
              <p className="text-center text-sm text-muted py-6">Add items to your closet to start building.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 px-4 pt-1">
                {tray.map((i) => (
                  <ItemThumb key={i.id} item={i} selected={selected.includes(i.id)} onClick={() => toggle(i.id)} />
                ))}
              </div>
            )}
          </div>

          <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title={editingOutfitId ? "Update outfit" : "Save outfit"}>
            <label className="block text-sm text-muted mb-1">Name</label>
            <input className={inputCls} value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Friday night" />
            <label className="block text-sm text-muted mb-1 mt-3">Occasion (optional)</label>
            <input className={inputCls} value={saveOccasion} onChange={(e) => setSaveOccasion(e.target.value)} placeholder="Dinner, office, weekend…" />
            <Button size="lg" className="mt-4" onClick={save} loading={busy}>Save</Button>
          </Sheet>
        </>
      ) : (
        <>
          <div className="px-4 mt-4">
            {anchorItem && (
              <Card className="p-2.5 flex items-center gap-3 mb-3">
                <ItemThumb item={anchorItem} size="xs" />
                <div className="flex-1 text-sm">Building around <b>{anchorItem.name}</b></div>
                <button onClick={() => setAnchor(null)} className="text-muted text-sm px-2">✕</button>
              </Card>
            )}
            <div className="flex gap-2">
              <input className={inputCls} placeholder="What's the occasion or vibe?" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generateIdeas()} />
              <Button onClick={() => generateIdeas()} loading={ideasLoading} disabled={!prompt.trim()}>Go</Button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4">
              {IDEA_CHIPS.map((c) => (
                <Chip key={c} active={prompt === c} onClick={() => generateIdeas(c)}>{c}</Chip>
              ))}
            </div>
          </div>
          <div className="px-4 mt-4 space-y-4">
            {ideasLoading && [0, 1, 2].map((i) => <div key={i} className="aspect-square rounded-2xl shimmer" />)}
            {!ideasLoading &&
              ideas.map((o, i) => (
                <OutfitCard
                  key={i}
                  suggestion={o}
                  source="ideas"
                  extraActions={
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        setSelected(o.itemIds);
                        setLayout([]);
                        setSaveName(o.name);
                        setSaveOccasion(o.occasion);
                        setRate(null);
                        setMode("build");
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Open in Build
                    </Button>
                  }
                />
              ))}
            {!ideasLoading && ideas.length === 0 && (
              <p className="text-center text-sm text-muted py-10">Pick a vibe above and I&apos;ll pull 3 looks from your closet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SwapRow({ swap, items, onApply }: { swap: RateResult["swaps"][number]; items: Item[]; onApply: () => void }) {
  const rm = items.find((i) => i.id === swap.removeItemId);
  const add = items.find((i) => i.id === swap.addItemId);
  return (
    <div className="flex items-center gap-2 bg-ink rounded-xl p-2">
      {rm && <ItemThumb item={rm} size="xs" />}
      {rm && add && <span className="text-muted">→</span>}
      {add && <ItemThumb item={add} size="xs" />}
      <p className="flex-1 text-xs text-paper/85">{swap.reason}</p>
      <Button size="sm" variant="outline" onClick={onApply}>Apply</Button>
    </div>
  );
}
