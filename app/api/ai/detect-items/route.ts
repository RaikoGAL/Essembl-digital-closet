import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, imageBlock, itemTagsSchema, stylistSystem, text } from "@/lib/ai-server";
import { contextSchema, handleError, parseBody } from "@/lib/api-utils";
import { normalizeDetected } from "@/lib/normalize";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({ image: z.string() });

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    const raw = await callStructured({
      system: stylistSystem(body.styleProfile, body.presentation),
      content: [
        imageBlock(body.image),
        text(
          "Detect every distinct clothing item, pair of shoes, bag and accessory visible in this photo (outfit selfie, mirror pic or flat-lay). " +
            "For each, return its catalog attributes and a tight bounding box in normalized 0-1000 coordinates [x1,y1,x2,y2] where (0,0) is top-left. Skip skin, hair and background."
        ),
      ],
      name: "save_detected_items",
      description: "Save all detected garments",
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tags: itemTagsSchema,
                box: { type: "array", items: { type: "integer", minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 },
              },
              required: ["tags", "box"],
            },
          },
        },
        required: ["items"],
      },
      maxTokens: 3000,
    });
    return NextResponse.json(normalizeDetected(raw));
  } catch (e) {
    return handleError(e);
  }
}
