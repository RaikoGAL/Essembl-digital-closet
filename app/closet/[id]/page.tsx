"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ItemEditor } from "@/components/ItemEditor";
import { OutfitCollage } from "@/components/OutfitCollage";
import { Button, Card, PageHeader, Section, Sheet, useBlobUrl } from "@/components/ui";
import { db } from "@/lib/db";
import type { Item, ItemTags } from "@/lib/types";
import Link from "next/link";

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const item = useLiveQuery(() => db.items.get(id), [id]);
  const outfits = useLiveQuery(() => db.outfits.filter((o) => o.itemIds.includes(id)).reverse().sortBy("createdAt"), [id]);
  const [edit, setEdit] = useState<ItemTags | null>(null);
  const url = useBlobUrl(item?.image);

  if (item === undefined) return <div className="p-10 text-center text-muted">Loading…</div>;
  if (!item) return <div className="p-10 text-center text-muted">Item not found.</div>;

  const toTags = (i: Item): ItemTags => ({
    name: i.name, category: i.category, subcategory: i.subcategory, colors: i.colors, primaryColor: i.primaryColor,
    pattern: i.pattern, material: i.material, seasons: i.seasons, formality: i.formality, styleTags: i.styleTags,
    description: i.description, brand: i.brand ?? "",
  });

  const save = async () => {
    if (!edit) return;
    await db.items.update(id, { ...edit, brand: edit.brand || undefined });
    setEdit(null);
  };

  const remove = async () => {
    if (!confirm(`Delete "${item.name}" from your closet?`)) return;
    await db.items.delete(id);
    // drop from outfits; delete outfits that become too small
    const affected = await db.outfits.filter((o) => o.itemIds.includes(id)).toArray();
    for (const o of affected) {
      const ids = o.itemIds.filter((x) => x !== id);
      if (ids.length < 2) await db.outfits.delete(o.id);
      else await db.outfits.update(o.id, { itemIds: ids, layout: o.layout?.filter((s) => s.itemId !== id) });
    }
    router.replace("/closet");
  };

  return (
    <div>
      <PageHeader
        title={item.name}
        subtitle={`${item.subcategory} · ${item.colors.join(", ")}`}
        back="/closet"
        right={
          <button onClick={() => db.items.update(id, { favorite: !item.favorite })} className="text-2xl w-10 h-10" aria-label="Favorite">
            {item.favorite ? "❤️" : "🤍"}
          </button>
        }
      />
      <div className="px-4 pt-4">
        <div className="aspect-square rounded-3xl bg-paper flex items-center justify-center overflow-hidden">
          {url && <img src={url} alt={item.name} className="max-w-[85%] max-h-[85%] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)]" />}
        </div>
      </div>

      <div className="px-4 mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Worn" value={`${item.wearCount}×`} />
        <Stat label="Formality" value={["", "Very casual", "Casual", "Smart", "Dressy", "Formal"][item.formality]} />
        <Stat label="Seasons" value={item.seasons.map((s) => ({ spring: "🌱", summer: "☀️", autumn: "🍂", winter: "❄️" })[s]).join(" ") || "—"} />
      </div>

      <div className="px-4 mt-4 flex flex-wrap gap-1.5">
        {[item.category, item.pattern, item.material, ...(item.brand ? [item.brand] : []), ...item.styleTags].map((t) => (
          <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-card border border-line">{t}</span>
        ))}
      </div>
      <p className="px-4 mt-3 text-sm text-muted">{item.description}</p>

      <div className="px-4 mt-5 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => router.push(`/studio?anchor=${id}`)}>✨ Style this</Button>
        <Button variant="ghost" onClick={() => setEdit(toTags(item))}>✏️ Edit</Button>
      </div>

      <Section title={`Outfits with this (${outfits?.length ?? 0})`}>
        {outfits && outfits.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {outfits.map((o) => (
              <OutfitMini key={o.id} itemIds={o.itemIds} name={o.name} id={o.id} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Not in any saved outfit yet.</p>
        )}
      </Section>

      <div className="px-4 mt-8">
        <Button variant="danger" onClick={remove} className="w-full">Delete item</Button>
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Edit item">
        {edit && (
          <>
            <ItemEditor value={edit} onChange={setEdit} />
            <Button size="lg" onClick={save}>Save changes</Button>
          </>
        )}
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="py-2.5">
      <div className="text-sm font-medium">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </Card>
  );
}

function OutfitMini({ itemIds, name, id }: { itemIds: string[]; name: string; id: string }) {
  const items = useLiveQuery(() => db.items.where("id").anyOf(itemIds).toArray(), [itemIds.join(",")]);
  return (
    <Link href={`/outfits/${id}`} className="block">
      <OutfitCollage items={items ?? []} className="rounded-2xl" />
      <p className="text-xs mt-1 truncate px-1">{name}</p>
    </Link>
  );
}
