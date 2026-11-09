import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, outfitSuggestionSchema, stylistSystem, text, wardrobeText } from "@/lib/ai-server";
import { contextSchema, handleError, itemSummarySchema, parseBody } from "@/lib/api-utils";
import type { ItemSummary, OutfitSuggestion } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({
  items: z.array(itemSummarySchema),
  weather: z.string().optional(),
  plans: z.string().optional(),
  mood: z.string().optional(),
  avoidItemIds: z.array(z.string()).optional(),
  recentlyWornIds: z.array(z.string()).optional(),
  count: z.number().min(1).max(5).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    if (body.items.length < 2) return NextResponse.json({ error: "Add at least 2 items to your closet first." }, { status: 400 });
    const count = body.count ?? 1;
    const out = await callStructured<{ outfits: OutfitSuggestion[] }>({
      system: stylistSystem(body.styleProfile, body.presentation),
      content: [
        text(wardrobeText(body.items as ItemSummary[])),
        text(
          [
            `Create ${count} complete outfit${count > 1 ? "s" : ""} for today from this wardrobe only.`,
            body.weather ? `Weather: ${body.weather}.` : "",
            body.plans ? `Plans / occasion: ${body.plans}.` : "",
            body.mood ? `Mood: ${body.mood}.` : "",
            body.recentlyWornIds?.length ? `Recently worn (prefer not to repeat): ${body.recentlyWornIds.join(", ")}.` : "",
            body.avoidItemIds?.length ? `Do NOT use these ids: ${body.avoidItemIds.join(", ")}.` : "",
            "Rules: a complete outfit = (top + bottom) or dress, plus shoes; add outerwear if the weather calls for it; add at most 2 accessories/bags. " +
              "Favor under-worn items when they fit. Make outfits clearly different from each other. Explain the color story and why it suits the weather and plans.",
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ],
      name: "propose_outfits",
      description: "Propose outfits built from wardrobe item ids",
      schema: { type: "object", properties: { outfits: { type: "array", items: outfitSuggestionSchema } }, required: ["outfits"] },
      maxTokens: 2000,
    });
    const valid = new Set(body.items.map((i) => i.id));
    out.outfits = out.outfits
      .map((o) => ({ ...o, itemIds: o.itemIds.filter((id) => valid.has(id)) }))
      .filter((o) => o.itemIds.length >= 2);
    return NextResponse.json(out);
  } catch (e) {
    return handleError(e);
  }
}
