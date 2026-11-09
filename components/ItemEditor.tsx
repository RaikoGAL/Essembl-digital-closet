"use client";
import { CATEGORIES, SEASONS, type ItemTags } from "@/lib/types";
import { Chip, Field, inputCls } from "./ui";

export function ItemEditor({ value, onChange }: { value: ItemTags; onChange: (v: ItemTags) => void }) {
  const set = <K extends keyof ItemTags>(k: K, v: ItemTags[K]) => onChange({ ...value, [k]: v });
  return (
    <div>
      <Field label="Name">
        <input className={inputCls} value={value.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Category">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={value.category === c} onClick={() => set("category", c)}>
              {c}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <input className={inputCls} value={value.subcategory} onChange={(e) => set("subcategory", e.target.value)} />
        </Field>
        <Field label="Brand (optional)">
          <input className={inputCls} value={value.brand ?? ""} onChange={(e) => set("brand", e.target.value)} />
        </Field>
      </div>
      <Field label="Colors (comma separated)">
        <input
          className={inputCls}
          value={value.colors.join(", ")}
          onChange={(e) => {
            const colors = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            onChange({ ...value, colors, primaryColor: colors[0] ?? value.primaryColor });
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pattern">
          <input className={inputCls} value={value.pattern} onChange={(e) => set("pattern", e.target.value)} />
        </Field>
        <Field label="Material">
          <input className={inputCls} value={value.material} onChange={(e) => set("material", e.target.value)} />
        </Field>
      </div>
      <Field label="Seasons">
        <div className="flex gap-2 flex-wrap">
          {SEASONS.map((s) => (
            <Chip
              key={s}
              active={value.seasons.includes(s)}
              onClick={() => set("seasons", value.seasons.includes(s) ? value.seasons.filter((x) => x !== s) : [...value.seasons, s])}
            >
              {s}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label={`Formality: ${["", "Very casual", "Casual", "Smart casual", "Dressy", "Formal"][value.formality] ?? ""}`}>
        <input type="range" min={1} max={5} value={value.formality} onChange={(e) => set("formality", Number(e.target.value))} className="w-full accent-accent" />
      </Field>
      <Field label="Style tags (comma separated)">
        <input className={inputCls} value={value.styleTags.join(", ")} onChange={(e) => set("styleTags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </Field>
      <Field label="Description">
        <textarea className={inputCls} rows={2} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
    </div>
  );
}
