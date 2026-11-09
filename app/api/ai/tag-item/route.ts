import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, imageBlock, itemTagsSchema, stylistSystem, text } from "@/lib/ai-server";
import { contextSchema, handleError, parseBody } from "@/lib/api-utils";
import { normalizeTags } from "@/lib/normalize";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({ image: z.string(), hint: z.string().optional() });

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    const raw = await callStructured({
      system: stylistSystem(body.styleProfile, body.presentation),
      content: [
        imageBlock(body.image),
        text(
          `Catalog this single clothing item for a digital wardrobe. ${body.hint ? `User hint: ${body.hint}.` : ""} ` +
            `If the photo shows a person wearing several things, describe only the most prominent garment.`
        ),
      ],
      name: "save_item",
      description: "Save the garment's attributes to the wardrobe",
      schema: itemTagsSchema,
      maxTokens: 800,
    });
    return NextResponse.json(normalizeTags(raw));
  } catch (e) {
    return handleError(e);
  }
}
