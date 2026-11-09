import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, imageBlock, outfitSuggestionSchema, stylistSystem, text, wardrobeText } from "@/lib/ai-server";
import { contextSchema, handleError, itemSummarySchema, parseBody } from "@/lib/api-utils";
import type { ItemSummary } from "@/lib/types";
import { normalizePair } from "@/lib/normalize";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({ items: z.array(itemSummarySchema), image: z.string(), note: z.string().optional() });

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    const raw = await callStructured({
      system: stylistSystem(body.styleProfile, body.presentation),
      content: [
        imageBlock(body.image),
        text(wardrobeText(body.items as ItemSummary[])),
        text(
          [
            "The image is a product the user is considering buying (store photo or screenshot).",
            body.note ? `User note: ${body.note}.` : "",
            "1) Give a buyScore 0-100 for how much it adds to this wardrobe (penalize near-duplicates and orphans with nothing to wear them with).",
            "2) Build up to 3 outfits combining the NEW item with existing wardrobe ids (do not include an id for the new item; mention it in the explanation).",
            "3) List ids of owned items that are near-duplicates.",
            "4) A one-paragraph verdict: buy / skip / buy in a different color.",
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ],
      name: "pair_new_item",
      description: "Return the purchase analysis",
      schema: {
        type: "object",
        properties: {
          verdict: { type: "string" },
          buyScore: { type: "integer", minimum: 0, maximum: 100 },
          outfits: { type: "array", items: outfitSuggestionSchema },
          similarOwned: { type: "array", items: { type: "string" } },
        },
        required: ["verdict", "buyScore", "outfits", "similarOwned"],
      },
      maxTokens: 2000,
    });
    return NextResponse.json(normalizePair(raw, new Set(body.items.map((i) => i.id))));
  } catch (e) {
    return handleError(e);
  }
}
