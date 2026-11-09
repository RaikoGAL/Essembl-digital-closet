"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item, LayoutSlot } from "@/lib/types";
import { defaultLayout } from "@/lib/images";
import { useBlobUrl } from "./ui";

function Piece({ item, slot, size, editable, onChange, onSelect, selected }: {
  item: Item;
  slot: LayoutSlot;
  size: number;
  editable?: boolean;
  onChange?: (s: LayoutSlot) => void;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const url = useBlobUrl(item.image);
  const base = size * 0.34 * slot.scale;
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: slot.x, oy: slot.y };
    onSelect?.();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!editable || !drag.current) return;
    const dx = (e.clientX - drag.current.sx) / size;
    const dy = (e.clientY - drag.current.sy) / size;
    onChange?.({ ...slot, x: Math.max(0.05, Math.min(0.95, drag.current.ox + dx)), y: Math.max(0.05, Math.min(0.95, drag.current.oy + dy)) });
  };
  const onPointerUp = () => (drag.current = null);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute touch-none select-none ${editable ? "cursor-grab active:cursor-grabbing" : ""} ${selected ? "outline outline-2 outline-accent rounded-lg" : ""}`}
      style={{
        left: slot.x * size,
        top: slot.y * size,
        width: base,
        transform: "translate(-50%, -50%)",
        zIndex: slot.z,
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={item.name} draggable={false} className="w-full h-auto max-h-[var(--maxh)] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)]" style={{ ["--maxh" as string]: `${base * 1.4}px` }} />
      )}
    </div>
  );
}

export function OutfitCollage({
  items,
  layout,
  onLayoutChange,
  editable,
  className = "",
  selectedId,
  onSelect,
}: {
  items: Item[];
  layout?: LayoutSlot[];
  onLayoutChange?: (l: LayoutSlot[]) => void;
  editable?: boolean;
  className?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const lay = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    const existing = (layout ?? []).filter((s) => ids.has(s.itemId));
    const missing = items.filter((i) => !existing.some((s) => s.itemId === i.id));
    const def = defaultLayout(items);
    const added = missing.map((m) => def.find((d) => d.itemId === m.id)!).map((s, i) => ({ ...s, z: existing.length + i }));
    return [...existing, ...added];
  }, [items, layout]);

  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <div ref={ref} className={`relative w-full aspect-square rounded-3xl bg-paper overflow-hidden ${className}`} onClick={() => onSelect?.(null)}>
      {lay.map((s) => {
        const it = byId.get(s.itemId);
        if (!it) return null;
        return (
          <Piece
            key={s.itemId}
            item={it}
            slot={s}
            size={size}
            editable={editable}
            selected={selectedId === s.itemId}
            onSelect={() => onSelect?.(s.itemId)}
            onChange={(ns) => onLayoutChange?.(lay.map((x) => (x.itemId === ns.itemId ? ns : x)))}
          />
        );
      })}
      {!items.length && <div className="absolute inset-0 flex items-center justify-center text-ink/40 text-sm">No items</div>}
    </div>
  );
}
