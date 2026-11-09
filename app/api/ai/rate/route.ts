import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, imageBlock, stylistSystem, text, wardrobeText } from "@/lib/ai-server";
import { contextSchema, handleError, itemSummarySchema, parseBody } from "@/lib/api-utils";
import type { ItemSummary } from "@/lib/types";
import { normalizeRate } from "@/lib/normalize";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({
  /** Either a selfie/photo of the look… */
  image: z.string().optional(),
  /** …or a set of wardrobe item ids composing the outfit */
  outfitItemIds: z.array(z.string()).optional(),
  items: z.array(itemSummarySchema).optional(),
  occasion: z.string().optional(),
});

const schema = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    headline: { type: "string", description: "One punchy sentence verdict" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" }, description: "Concrete, kind, actionable tips" },
    swaps: {
      type: "array",
      description: "Only when a wardrobe was provided: swap suggestions using real item ids",
      items: {
        type: "object",
        properties: {
          removeItemId: { type: "string" },
          addItemId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["reason"],
      },
    },
  },
  required: ["score", "headline", "strengths", "improvements", "swaps"],
};

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    if (!body.image && !body.outfitItemIds?.length) return NextResponse.json({ error: "Provide an image or an outfit." }, { status: 400 });
    const content = [];
    if (body.image) content.push(imageBlock(body.image));
    if (body.items?.length) content.push(text(wardrobeText(body.items as ItemSummary[])));
    content.push(
      text(
        [
          body.image ? "Rate the outfit worn in this photo." : `Rate the outfit made of these wardrobe items: ${body.outfitItemIds!.join(", ")}.`,
          body.occasion ? `Occasion: ${body.occasion}.` : "",
          "Score 0-100 (70 = solid everyday look, 85+ = excellent, 95+ = editorial). Judge color harmony, fit/proportion, cohesion, occasion-appropriateness and finishing details.",
          body.items?.length
            ? "Suggest up to 3 swaps using items from the wardrobe that would raise the score (reference real ids)."
            : "Return an empty swaps array.",
        ]
          .filter(Boolean)
          .join("\n")
      )
    );
    const raw = await callStructured({
      system: stylistSystem(body.styleProfile, body.presentation),
      content,
      name: "rate_outfit",
      description: "Return the outfit rating",
      schema,
      maxTokens: 1200,
    });
    return NextResponse.json(normalizeRate(raw, body.items ? new Set(body.items.map((i) => i.id)) : undefined));
  } catch (e) {
    return handleError(e);
  }
}
