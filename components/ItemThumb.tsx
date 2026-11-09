"use client";
import type { Item } from "@/lib/types";
import { useBlobUrl } from "./ui";

export function ItemThumb({
  item,
  size = "md",
  selected,
  onClick,
  showName,
  badge,
}: {
  item: Item;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
  showName?: boolean;
  badge?: string;
}) {
  const url = useBlobUrl(item.thumb ?? item.image);
  const dims = { xs: "w-12 h-12", sm: "w-20 h-20", md: "w-full aspect-square", lg: "w-full aspect-[4/5]" }[size];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 ${dims} rounded-2xl bg-paper/95 overflow-hidden border-2 transition ${
        selected ? "border-accent ring-2 ring-accent/30" : "border-transparent"
      } ${onClick ? "active:scale-[0.97]" : "cursor-default"}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={item.name} className="w-full h-full object-contain p-1.5" loading="lazy" />
      ) : (
        <div className="w-full h-full animate-pulse bg-line" />
      )}
      {item.favorite && <span className="absolute top-1.5 right-1.5 text-xs">❤️</span>}
      {badge && <span className="absolute top-1.5 left-1.5 text-[10px] bg-ink/80 text-paper px-1.5 py-0.5 rounded-full">{badge}</span>}
      {showName && (
        <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-ink/80 to-transparent text-paper text-[11px] px-2 pb-1.5 pt-4 text-left truncate">
          {item.name}
        </span>
      )}
    </button>
  );
}
