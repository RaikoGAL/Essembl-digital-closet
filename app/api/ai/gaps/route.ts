import { NextResponse } from "next/server";
import { z } from "zod";
import { callStructured, stylistSystem, text, wardrobeText } from "@/lib/ai-server";
import { contextSchema, handleError, itemSummarySchema, parseBody } from "@/lib/api-utils";
import { CATEGORIES, type GapReport, type ItemSummary } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = contextSchema.extend({ items: z.array(itemSummarySchema), budget: z.string().optional(), goals: z.string().optional() });

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, bodySchema);
    const out = await callStructured<GapReport>({
      system: stylistSystem(body.styleProfile, body.presentation),
      content: [
        text(wardrobeText(body.items as ItemSummary[])),
        text(
          [
            "Analyze this wardrobe like a professional stylist doing a closet audit.",
            body.goals ? `User goals: ${body.goals}.` : "",
            body.budget ? `Budget: ${body.budget}.` : "",
            "Identify 4-7 missing pieces that would unlock the most new outfits (versatile basics first, then statement pieces). For each gap give a concrete shopping search query (e.g. 'white leather low-top sneakers'), the color to buy, priority, and which existing item ids it would pair with.",
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ],
      name: "closet_audit",
      description: "Return the wardrobe gap analysis",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          gaps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: { type: "string" },
                why: { type: "string" },
                category: { type: "string", enum: [...CATEGORIES] },
                colorSuggestion: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                searchQuery: { type: "string" },
                pairsWith: { type: "array", items: { type: "string" } },
              },
              required: ["item", "why", "category", "colorSuggestion", "priority", "searchQuery", "pairsWith"],
            },
          },
        },
        required: ["summary", "strengths", "gaps"],
      },
      maxTokens: 2500,
    });
    return NextResponse.json(out);
  } catch (e) {
    return handleError(e);
  }
}
