import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, outfitSuggestionSchema, stylistSystem, text, wardrobeText } from "@/lib/ai-server";
import { contextSchema, handleError, itemSummarySchema, parseBody } from "@/lib/api-utils";
import type { ItemSummary, OutfitSuggestion } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({
  items: z.array(itemSummarySchema),
  prompt: z.string(),
  anchorItemIds: z.array(z.string()).optional(),
  count: z.number().min(1).max(6).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    if (body.items.length < 2) return NextResponse.json({ error: "Add at least 2 items to your closet first." }, { status: 400 });
    const count = body.count ?? 3;
    const out = await callStructured<{ outfits: OutfitSuggestion[] }>({
      system: stylistSystem(body.styleProfile, body.presentation),
      content: [
        text(wardrobeText(body.items as ItemSummary[])),
        text(
          [
            `Give me ${count} outfit ideas from this wardrobe for: "${body.prompt}".`,
            body.anchorItemIds?.length ? `Each outfit MUST include these items: ${body.anchorItemIds.join(", ")}.` : "",
            "Each outfit must be complete and wearable (top+bottom or dress, shoes, optional outerwear/accessories). Make them distinct from each other. Score each 0-100 for how well it fits the request.",
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ],
      name: "propose_outfits",
      description: "Propose outfits built from wardrobe item ids",
      schema: { type: "object", properties: { outfits: { type: "array", items: outfitSuggestionSchema } }, required: ["outfits"] },
      maxTokens: 2500,
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
