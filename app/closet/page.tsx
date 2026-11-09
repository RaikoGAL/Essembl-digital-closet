"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { CATEGORIES, type Category } from "@/lib/types";
import { ItemThumb } from "@/components/ItemThumb";
import { Chip, EmptyState, PageHeader, Button, inputCls } from "@/components/ui";
import { OutfitCollage } from "@/components/OutfitCollage";

export default function ClosetPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"items" | "outfits">("items");
  const [cat, setCat] = useState<Category | "all" | "favorites">("all");
  const [q, setQ] = useState("");
  const items = useLiveQuery(() => db.items.orderBy("createdAt").reverse().toArray(), []);
  const outfits = useLiveQuery(() => db.outfits.orderBy("createdAt").reverse().toArray(), []);
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const [folder, setFolder] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat === "favorites" && !i.favorite) return false;
      if (cat !== "all" && cat !== "favorites" && i.category !== cat) return false;
      if (s) {
        const hay = `${i.name} ${i.subcategory} ${i.colors.join(" ")} ${i.styleTags.join(" ")} ${i.brand ?? ""} ${i.material}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, cat, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    items?.forEach((i) => (c[i.category] = (c[i.category] ?? 0) + 1));
    return c;
  }, [items]);

  const filteredOutfits = useMemo(() => (outfits ?? []).filter((o) => folder === "all" || o.folderId === folder), [outfits, folder]);

  return (
    <div>
      <PageHeader
        title="Closet"
        subtitle={items ? `${items.length} items · ${outfits?.length ?? 0} outfits` : undefined}
        right={
          <Link href="/closet/add" className="bg-accent text-ink rounded-full w-10 h-10 flex items-center justify-center text-2xl leading-none font-light" aria-label="Add item">
            +
          </Link>
        }
      />

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 bg-card rounded-full p-1">
          {(["items", "outfits"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`py-2 rounded-full text-sm font-medium capitalize ${tab === t ? "bg-paper text-ink" : "text-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "items" ? (
        <>
          <div className="px-4 pt-3">
            <input className={inputCls} placeholder="Search colors, brands, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>All {items?.length ?? ""}</Chip>
            <Chip active={cat === "favorites"} onClick={() => setCat("favorites")}>❤️ Favorites</Chip>
            {CATEGORIES.filter((c) => counts[c]).map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                {c} {counts[c]}
              </Chip>
            ))}
          </div>

          {items && items.length === 0 ? (
            <EmptyState
              icon="🧥"
              title="Your closet is empty"
              body="Snap photos of your clothes — the background gets removed and every piece is tagged automatically."
              action={<Button onClick={() => router.push("/closet/add")}>Add your first items</Button>}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 px-4">
              {filtered.map((it) => (
                <ItemThumb key={it.id} item={it} onClick={() => router.push(`/closet/${it.id}`)} showName />
              ))}
              {filtered.length === 0 && items && <p className="col-span-3 text-center text-muted text-sm py-10">Nothing matches.</p>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
            <Chip active={folder === "all"} onClick={() => setFolder("all")}>All</Chip>
            {folders?.map((f) => (
              <Chip key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)}>
                📁 {f.name}
              </Chip>
            ))}
            <Chip
              onClick={async () => {
                const name = prompt("Folder name");
                if (name?.trim()) await db.folders.add({ id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now() });
              }}
            >
              + Folder
            </Chip>
          </div>
          {filteredOutfits.length === 0 ? (
            <EmptyState icon="✨" title="No saved outfits yet" body="Outfits you save from Today, Studio or Ideas show up here." action={<Button onClick={() => router.push("/studio")}>Open Studio</Button>} />
          ) : (
            <div className="grid grid-cols-2 gap-3 px-4">
              {filteredOutfits.map((o) => (
                <OutfitTile key={o.id} id={o.id} itemIds={o.itemIds} name={o.name} worn={o.wornDates?.length ?? 0} layout={o.layout} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OutfitTile({ id, itemIds, name, worn, layout }: { id: string; itemIds: string[]; name: string; worn: number; layout?: import("@/lib/types").LayoutSlot[] }) {
  const items = useLiveQuery(() => db.items.where("id").anyOf(itemIds).toArray(), [itemIds.join(",")]);
  return (
    <Link href={`/outfits/${id}`} className="block active:scale-[0.98] transition">
      <OutfitCollage items={items ?? []} layout={layout} className="rounded-2xl" />
      <div className="mt-1.5 px-1">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted">{worn ? `Worn ${worn}×` : "Not worn yet"}</p>
      </div>
    </Link>
  );
}
