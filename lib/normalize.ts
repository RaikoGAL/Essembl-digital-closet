/**
 * Coerce whatever the AI (or an older saved record) gives us into the exact shapes the UI expects.
 * Every field gets a safe default, so a slightly-off answer can never crash a screen.
 */
import {
  CATEGORIES,
  SEASONS,
  type Category,
  type DetectedItem,
  type GapReport,
  type Item,
  type ItemTags,
  type Outfit,
  type OutfitSuggestion,
  type PairResult,
  type RateResult,
  type Season,
  type TravelPlan,
} from "./types";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
export const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : v == null ? d : String(v));
export const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
export const strArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => str(x).trim()).filter(Boolean)
    : typeof v === "string"
      ? v.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
const objArr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

/** Unwrap common wrappers models produce: {input:{…}}, {"tool_name":{…}}, {arguments:"{…}"} */
export function unwrap(raw: unknown, toolName?: string): unknown {
  let v = raw;
  for (let i = 0; i < 3; i++) {
    if (!isObj(v)) break;
    const o: Obj = v;
    if (typeof o.arguments === "string") {
      try {
        v = JSON.parse(o.arguments);
        continue;
      } catch {
        /* ignore */
      }
    }
    if (isObj(o.input)) { v = o.input; continue; }
    if (toolName && isObj(o[toolName])) { v = o[toolName]; continue; }
    if (isObj(o.parameters)) { v = o.parameters; continue; }
    break;
  }
  return v;
}

function category(v: unknown): Category {
  const c = str(v).toLowerCase().trim();
  if ((CATEGORIES as readonly string[]).includes(c)) return c as Category;
  const map: Record<string, Category> = {
    top: "tops", shirt: "tops", tshirt: "tops", "t-shirt": "tops", hoodie: "tops", sweater: "tops", sweatshirt: "tops",
    bottom: "bottoms", pants: "bottoms", jeans: "bottoms", trousers: "bottoms", shorts: "bottoms", skirt: "bottoms",
    dress: "dresses", jacket: "outerwear", coat: "outerwear", shoe: "shoes", sneakers: "shoes", boots: "shoes",
    bag: "bags", hat: "accessories", cap: "accessories", accessory: "accessories", jewelry: "accessories", belt: "accessories",
  };
  return map[c] ?? "other";
}

function seasons(v: unknown): Season[] {
  const s = strArr(v).map((x) => x.toLowerCase().replace("fall", "autumn"));
  const out = s.filter((x) => (SEASONS as readonly string[]).includes(x)) as Season[];
  if (s.some((x) => x.includes("all"))) return [...SEASONS];
  return out.length ? out : [...SEASONS];
}

export function normalizeTags(raw: unknown): ItemTags {
  const r = isObj(raw) ? raw : {};
  const colors = strArr(r.colors ?? r.color);
  return {
    name: str(r.name, "Untitled item").trim() || "Untitled item",
    category: category(r.category),
    subcategory: str(r.subcategory ?? r.type),
    colors,
    primaryColor: str(r.primaryColor, colors[0] ?? ""),
    pattern: str(r.pattern, "solid"),
    material: str(r.material),
    seasons: seasons(r.seasons ?? r.season),
    formality: Math.round(num(r.formality, 2, 1, 5)),
    styleTags: strArr(r.styleTags ?? r.tags),
    description: str(r.description),
    brand: str(r.brand) || undefined,
  };
}

export function normalizeDetected(raw: unknown): { items: DetectedItem[] } {
  const r = isObj(raw) ? raw : {};
  const items = objArr(r.items).map((it) => {
    const b = Array.isArray(it.box) ? it.box.map((x) => num(x, 0, 0, 1000)) : [];
    const box: [number, number, number, number] = b.length === 4 && b[2] > b[0] && b[3] > b[1] ? [b[0], b[1], b[2], b[3]] : [0, 0, 1000, 1000];
    return { tags: normalizeTags(isObj(it.tags) ? it.tags : it), box };
  });
  return { items };
}

export function normalizeSuggestion(raw: unknown, valid?: Set<string>): OutfitSuggestion {
  const r = isObj(raw) ? raw : {};
  let ids = strArr(r.itemIds ?? r.items ?? r.ids);
  if (valid) ids = ids.filter((id) => valid.has(id));
  return {
    name: str(r.name, "Outfit") || "Outfit",
    itemIds: Array.from(new Set(ids)),
    explanation: str(r.explanation ?? r.reason),
    occasion: str(r.occasion),
    score: Math.round(num(r.score, 75, 0, 100)),
  };
}

export function normalizeOutfits(raw: unknown, valid: Set<string>, minItems = 2): { outfits: OutfitSuggestion[] } {
  const r = isObj(raw) ? raw : {};
  const list = Array.isArray(raw) ? raw : objArr(r.outfits);
  return { outfits: list.map((o) => normalizeSuggestion(o, valid)).filter((o) => o.itemIds.length >= minItems) };
}

export function normalizeRate(raw: unknown, valid?: Set<string>): RateResult {
  const r = isObj(raw) ? raw : {};
  return {
    score: Math.round(num(r.score, 70, 0, 100)),
    headline: str(r.headline ?? r.verdict, "Here's my take"),
    strengths: strArr(r.strengths),
    improvements: strArr(r.improvements ?? r.tips),
    swaps: objArr(r.swaps)
      .map((s) => ({
        removeItemId: str(s.removeItemId) || undefined,
        addItemId: str(s.addItemId) || undefined,
        reason: str(s.reason),
      }))
      .map((s) => (valid ? { ...s, removeItemId: s.removeItemId && valid.has(s.removeItemId) ? s.removeItemId : undefined, addItemId: s.addItemId && valid.has(s.addItemId) ? s.addItemId : undefined } : s))
      .filter((s) => s.reason || s.addItemId || s.removeItemId),
  };
}

export function normalizeGaps(raw: unknown, valid: Set<string>): GapReport {
  const r = isObj(raw) ? raw : {};
  const pr = (v: unknown): "high" | "medium" | "low" => {
    const p = str(v).toLowerCase();
    return p === "high" || p === "low" ? p : "medium";
  };
  return {
    summary: str(r.summary),
    strengths: strArr(r.strengths),
    gaps: objArr(r.gaps).map((g) => ({
      item: str(g.item ?? g.name, "Wardrobe piece"),
      why: str(g.why ?? g.reason),
      category: category(g.category),
      colorSuggestion: str(g.colorSuggestion ?? g.color),
      priority: pr(g.priority),
      searchQuery: str(g.searchQuery, str(g.item ?? g.name)),
      pairsWith: strArr(g.pairsWith).filter((id) => valid.has(id)),
    })),
  };
}

export function normalizePair(raw: unknown, valid: Set<string>): PairResult {
  const r = isObj(raw) ? raw : {};
  return {
    verdict: str(r.verdict),
    buyScore: Math.round(num(r.buyScore ?? r.score, 50, 0, 100)),
    outfits: objArr(r.outfits).map((o) => normalizeSuggestion(o, valid)).filter((o) => o.itemIds.length >= 1),
    similarOwned: strArr(r.similarOwned).filter((id) => valid.has(id)),
  };
}

export function normalizeTravel(raw: unknown, valid: Set<string>): TravelPlan {
  const r = isObj(raw) ? raw : {};
  return {
    summary: str(r.summary),
    packingItemIds: Array.from(new Set(strArr(r.packingItemIds).filter((id) => valid.has(id)))),
    days: objArr(r.days).map((d) => ({
      date: str(d.date),
      label: str(d.label, str(d.date)),
      weather: str(d.weather),
      itemIds: strArr(d.itemIds).filter((id) => valid.has(id)),
      note: str(d.note),
    })),
    missing: strArr(r.missing),
  };
}

/** Repair an item read from IndexedDB (older or malformed records). Mutates and returns it. */
export function repairItem(it: Item): Item {
  const t = normalizeTags(it);
  it.name = t.name;
  it.category = t.category;
  it.subcategory = t.subcategory;
  it.colors = t.colors;
  it.primaryColor = t.primaryColor;
  it.pattern = t.pattern;
  it.material = t.material;
  it.seasons = t.seasons;
  it.formality = t.formality;
  it.styleTags = t.styleTags;
  it.description = t.description;
  it.favorite = !!it.favorite;
  it.wearCount = num(it.wearCount, 0, 0);
  it.createdAt = num(it.createdAt, Date.now());
  return it;
}

export function repairOutfit(o: Outfit): Outfit {
  o.name = str(o.name, "Outfit") || "Outfit";
  o.itemIds = strArr(o.itemIds);
  o.wornDates = strArr(o.wornDates);
  if (o.layout && !Array.isArray(o.layout)) o.layout = undefined;
  o.createdAt = num(o.createdAt, Date.now());
  return o;
}
