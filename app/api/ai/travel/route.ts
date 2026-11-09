import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, stylistSystem, text, wardrobeText } from "@/lib/ai-server";
import { contextSchema, handleError, itemSummarySchema, parseBody } from "@/lib/api-utils";
import type { ItemSummary, TravelPlan } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({
  items: z.array(itemSummarySchema),
  destination: z.string(),
  days: z.array(z.object({ date: z.string(), weather: z.string() })),
  activities: z.string().optional(),
  luggage: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    if (body.items.length < 3) return NextResponse.json({ error: "Add a few more items to your closet first." }, { status: 400 });
    const out = await callStructured<TravelPlan>({
      system: stylistSystem(body.styleProfile, body.presentation),
      content: [
        text(wardrobeText(body.items as ItemSummary[])),
        text(
          [
            `Plan a capsule travel wardrobe for a trip to ${body.destination}.`,
            `Days and forecast:\n${body.days.map((d) => `- ${d.date}: ${d.weather}`).join("\n")}`,
            body.activities ? `Activities: ${body.activities}.` : "",
            body.luggage ? `Luggage: ${body.luggage}.` : "",
            "Pick the smallest set of wardrobe item ids that can be re-mixed into a complete outfit for every day (re-use bottoms/shoes/outerwear across days). " +
              "Return the packing list ids, an outfit per day (ids + a short note), and anything missing from the wardrobe that the trip really needs.",
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ],
      name: "travel_plan",
      description: "Return the travel wardrobe plan",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          packingItemIds: { type: "array", items: { type: "string" } },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                label: { type: "string" },
                weather: { type: "string" },
                itemIds: { type: "array", items: { type: "string" } },
                note: { type: "string" },
              },
              required: ["date", "label", "weather", "itemIds", "note"],
            },
          },
          missing: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "packingItemIds", "days", "missing"],
      },
      maxTokens: 3500,
    });
    const valid = new Set(body.items.map((i) => i.id));
    out.packingItemIds = out.packingItemIds.filter((id) => valid.has(id));
    out.days = out.days.map((d) => ({ ...d, itemIds: d.itemIds.filter((id) => valid.has(id)) }));
    return NextResponse.json(out);
  } catch (e) {
    return handleError(e);
  }
}
