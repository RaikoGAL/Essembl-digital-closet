export const CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "bags",
  "accessories",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export interface Item {
  id: string;
  createdAt: number;
  /** Processed image (background removed when possible), PNG/WebP blob */
  image: Blob;
  /** Small thumbnail for grids */
  thumb: Blob;
  name: string;
  category: Category;
  subcategory: string;
  colors: string[];
  primaryColor: string;
  pattern: string;
  material: string;
  seasons: Season[];
  /** 1 = very casual … 5 = black tie */
  formality: number;
  styleTags: string[];
  description: string;
  brand?: string;
  favorite: boolean;
  wearCount: number;
  lastWorn?: number;
  source: "photo" | "selfie" | "screenshot" | "manual";
}

export interface LayoutSlot {
  itemId: string;
  x: number; // 0..1 (fraction of canvas width)
  y: number; // 0..1
  scale: number; // relative to base size
  z: number;
}

export interface Outfit {
  id: string;
  createdAt: number;
  name: string;
  itemIds: string[];
  layout?: LayoutSlot[];
  occasion?: string;
  explanation?: string;
  score?: number;
  folderId?: string;
  source: "today" | "studio" | "ideas" | "travel" | "manual";
  /** YYYY-MM-DD it was generated for (Today) */
  forDate?: string;
  wornDates: string[];
  weather?: WeatherSnapshot;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface WeatherSnapshot {
  tempC: number;
  feelsLikeC: number;
  minC: number;
  maxC: number;
  precipProb: number;
  code: number;
  label: string;
  windKmh: number;
  locationName?: string;
}

export interface Settings {
  id: "main";
  locationName?: string;
  lat?: number;
  lon?: number;
  units: "metric" | "imperial";
  /** Free-text style profile used in every AI prompt */
  styleProfile: string;
  presentation: "womenswear" | "menswear" | "mixed";
  removeBackground: boolean;
  dailyHour: number; // 0..23 local hour for daily outfit reminder
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "main",
  units: "metric",
  styleProfile: "",
  presentation: "mixed",
  removeBackground: true,
  dailyHour: 7,
  onboarded: false,
};

/** Fields the AI returns when tagging a single garment photo */
export interface ItemTags {
  name: string;
  category: Category;
  subcategory: string;
  colors: string[];
  primaryColor: string;
  pattern: string;
  material: string;
  seasons: Season[];
  formality: number;
  styleTags: string[];
  description: string;
  brand?: string;
}

/** Compact representation of an item sent to the AI */
export interface ItemSummary {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  colors: string[];
  pattern: string;
  material: string;
  seasons: Season[];
  formality: number;
  styleTags: string[];
  wearCount: number;
  favorite: boolean;
}

export function summarize(item: Item): ItemSummary {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    colors: item.colors,
    pattern: item.pattern,
    material: item.material,
    seasons: item.seasons,
    formality: item.formality,
    styleTags: item.styleTags,
    wearCount: item.wearCount,
    favorite: item.favorite,
  };
}

export interface OutfitSuggestion {
  name: string;
  itemIds: string[];
  explanation: string;
  occasion: string;
  score: number;
}

export interface RateResult {
  score: number; // 0..100
  headline: string;
  strengths: string[];
  improvements: string[];
  swaps: { removeItemId?: string; addItemId?: string; reason: string }[];
}

export interface DetectedItem {
  tags: ItemTags;
  /** bounding box in 0..1000 coordinates [x1,y1,x2,y2] */
  box: [number, number, number, number];
}

export interface GapReport {
  summary: string;
  strengths: string[];
  gaps: {
    item: string;
    why: string;
    category: Category;
    colorSuggestion: string;
    priority: "high" | "medium" | "low";
    searchQuery: string;
    pairsWith: string[]; // item ids
  }[];
}

export interface PairResult {
  verdict: string;
  buyScore: number; // 0..100 how much it adds to wardrobe
  outfits: OutfitSuggestion[];
  similarOwned: string[]; // item ids that are near-duplicates
}

export interface TravelPlan {
  summary: string;
  packingItemIds: string[];
  days: {
    date: string;
    label: string;
    weather: string;
    itemIds: string[];
    note: string;
  }[];
  missing: string[];
}
