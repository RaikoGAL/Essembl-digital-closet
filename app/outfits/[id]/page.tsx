"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { OutfitCollage } from "@/components/OutfitCollage";
import { useItemsById } from "@/components/OutfitCard";
import { Button, Card, Chip, PageHeader, ScoreRing, Sheet, inputCls } from "@/components/ui";
import { db, markWorn, todayKey } from "@/lib/db";
import { renderOutfitImage, shareOrDownload } from "@/lib/images";

export default function OutfitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const outfit = useLiveQuery(() => db.outfits.get(id), [id]);
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const items = useItemsById(outfit?.itemIds ?? []);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  if (outfit === undefined) return <div className="p-10 text-center text-muted">Loading…</div>;
  if (!outfit) return <div className="p-10 text-center text-muted">Outfit not found.</div>;

  const wornToday = outfit.wornDates?.includes(todayKey());

  return (
    <div>
      <PageHeader title={outfit.name} subtitle={outfit.occasion} back="/closet" right={outfit.score != null ? <ScoreRing score={outfit.score} size={44} /> : undefined} />
      <div className="px-4 pt-4">
        <OutfitCollage items={items} layout={outfit.layout} />
      </div>
      {outfit.explanation && <p className="px-4 mt-4 text-sm text-paper/85 leading-relaxed">{outfit.explanation}</p>}
      {outfit.weather && (
        <p className="px-4 mt-2 text-xs text-muted">
          Made for {outfit.forDate} · {outfit.weather.label}, {outfit.weather.tempC}°C
        </p>
      )}

      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        {items.map((i) => (
          <button key={i.id} onClick={() => router.push(`/closet/${i.id}`)} className="text-left">
            <Card className="p-2 text-xs truncate">{i.name}</Card>
          </button>
        ))}
      </div>

      <div className="px-4 mt-5 grid grid-cols-2 gap-2">
        <Button onClick={async () => { await markWorn(outfit); }} disabled={!!wornToday}>{wornToday ? "✓ Worn today" : "Wear today"}</Button>
        <Button
          variant="ghost"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const b = await renderOutfitImage(items, outfit.layout, { title: outfit.name, subtitle: outfit.occasion });
            await shareOrDownload(b, "outfit.png", outfit.explanation);
            setBusy(false);
          }}
        >
          Share
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/studio?outfit=${outfit.id}`)}>Edit in Studio</Button>
        <Button variant="ghost" onClick={() => { setName(outfit.name); setRenaming(true); }}>Rename</Button>
      </div>

      <div className="px-4 mt-6">
        <p className="text-sm text-muted mb-2">Folder</p>
        <div className="flex gap-2 flex-wrap">
          <Chip active={!outfit.folderId} onClick={() => db.outfits.update(id, { folderId: undefined })}>None</Chip>
          {folders?.map((f) => (
            <Chip key={f.id} active={outfit.folderId === f.id} onClick={() => db.outfits.update(id, { folderId: f.id })}>📁 {f.name}</Chip>
          ))}
        </div>
      </div>

      {outfit.wornDates?.length > 0 && (
        <div className="px-4 mt-6">
          <p className="text-sm text-muted mb-2">Worn on</p>
          <div className="flex gap-2 flex-wrap">
            {[...outfit.wornDates].reverse().map((d) => (
              <span key={d} className="text-xs px-2.5 py-1 rounded-full bg-card border border-line">{d}</span>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-8">
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            if (!confirm("Delete this outfit?")) return;
            await db.outfits.delete(id);
            router.replace("/closet");
          }}
        >
          Delete outfit
        </Button>
      </div>

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Rename outfit">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="lg" className="mt-4" onClick={async () => { await db.outfits.update(id, { name: name.trim() || outfit.name }); setRenaming(false); }}>Save</Button>
      </Sheet>
    </div>
  );
}
