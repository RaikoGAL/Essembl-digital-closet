import Anthropic from "@anthropic-ai/sdk";
import type { ItemSummary } from "./types";
import { CATEGORIES, SEASONS } from "./types";
import { unwrap } from "./normalize";

export const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";

let _client: Anthropic | null = null;
export function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AIError("Missing ANTHROPIC_API_KEY. Add it in your deployment's environment variables.", 500);
  }
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export class AIError extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}

type ContentBlock = Anthropic.Messages.ContentBlockParam;

/** Turn a data URL (data:image/jpeg;base64,...) into an Anthropic image block */
export function imageBlock(dataUrl: string): ContentBlock {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new AIError("Invalid image data URL");
  return {
    type: "image",
    source: { type: "base64", media_type: m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: m[2] },
  };
}

export function text(t: string): ContentBlock {
  return { type: "text", text: t };
}

/**
 * Ask Claude for a structured JSON answer by forcing a single tool call whose
 * input schema is the shape we want back.
 */
export async function callStructured<T = unknown>(opts: {
  system: string;
  content: ContentBlock[];
  name: string;
  description: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  // Newer models reject forced tool_choice ("tool"/"any"), so we offer the tool with
  // tool_choice "auto" and instruct the model to always answer through it. If it answers
  // in plain text instead, we pull the JSON out of the text, and retry once if that fails.
  const tool = { name: opts.name, description: opts.description, input_schema: opts.schema as Anthropic.Messages.Tool.InputSchema };
  const system = `${opts.system}\n\nIMPORTANT: Always answer by calling the \`${opts.name}\` tool exactly once, with arguments matching its schema. Do not answer in plain text.`;

  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      system,
      tools: [tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: opts.content }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use") return unwrap(block.input, opts.name) as T;

    lastText = res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    const parsed = extractJson<T>(lastText);
    if (parsed) return unwrap(parsed, opts.name) as T;
  }
  console.error("No structured output. Last text:", lastText.slice(0, 500));
  throw new AIError("The AI didn't return a usable answer. Please try again.", 502);
}

function extractJson<T>(s: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  const candidate = fenced ? fenced[1] : s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export function stylistSystem(profile?: string, presentation?: string): string {
  return [
    "You are a world-class personal stylist and fashion advisor working inside a digital-closet app.",
    "You only recommend clothing the user actually owns unless explicitly asked for shopping advice.",
    "Be specific, warm and practical. Explain color harmony, silhouette, proportion, layering and occasion fit in plain language.",
    presentation && presentation !== "mixed" ? `The user dresses in ${presentation}.` : "",
    profile ? `User style profile: ${profile}` : "",
    "Never invent item ids: use only ids present in the wardrobe list you were given.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function wardrobeText(items: ItemSummary[]): string {
  if (!items.length) return "WARDROBE: (empty)";
  const lines = items.map(
    (i) =>
      `- id=${i.id} | ${i.name} | ${i.category}/${i.subcategory} | colors: ${i.colors.join(", ")} | ${i.pattern}, ${i.material} | seasons: ${i.seasons.join("/")} | formality ${i.formality}/5 | tags: ${i.styleTags.join(", ")} | worn ${i.wearCount}x${i.favorite ? " | ★favorite" : ""}`
  );
  return `WARDROBE (${items.length} items):\n${lines.join("\n")}`;
}

/* ---------- Shared JSON schemas ---------- */

export const itemTagsSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short display name, e.g. 'Black slim-fit jeans'" },
    category: { type: "string", enum: [...CATEGORIES] },
    subcategory: { type: "string", description: "e.g. t-shirt, hoodie, chinos, sneakers, crossbody bag" },
    colors: { type: "array", items: { type: "string" }, description: "Simple color names, most dominant first" },
    primaryColor: { type: "string" },
    pattern: { type: "string", description: "solid, striped, plaid, floral, graphic, logo, etc." },
    material: { type: "string", description: "best guess: cotton, denim, wool, leather, knit, synthetic…" },
    seasons: { type: "array", items: { type: "string", enum: [...SEASONS] } },
    formality: { type: "integer", minimum: 1, maximum: 5 },
    styleTags: { type: "array", items: { type: "string" }, description: "3-6 tags: casual, streetwear, smart-casual, minimal, sporty, preppy, boho…" },
    description: { type: "string", description: "One sentence describing cut, fit and notable details" },
    brand: { type: "string", description: "Only if a logo/label is clearly visible, otherwise empty string" },
  },
  required: ["name", "category", "subcategory", "colors", "primaryColor", "pattern", "material", "seasons", "formality", "styleTags", "description"],
};

export const outfitSuggestionSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    itemIds: { type: "array", items: { type: "string" } },
    explanation: { type: "string", description: "2-3 sentences on why it works" },
    occasion: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["name", "itemIds", "explanation", "occasion", "score"],
};
