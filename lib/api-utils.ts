import { NextResponse } from "next/server";
import { z } from "zod";
import { AIError } from "./ai-server";

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new AIError("Invalid JSON body");
  }
  const r = schema.safeParse(json);
  if (!r.success) throw new AIError("Bad request: " + r.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; "));
  return r.data;
}

export function handleError(e: unknown) {
  console.error(e);
  if (e instanceof AIError) return NextResponse.json({ error: e.message }, { status: e.status });
  const anyE = e as { status?: number; message?: string; error?: { message?: string; error?: { message?: string } } };
  // Anthropic SDK errors nest the useful message at error.error.message; fall back to the raw message
  const msg = anyE?.error?.error?.message || anyE?.error?.message || anyE?.message || "Unexpected error";
  return NextResponse.json({ error: msg }, { status: anyE?.status && anyE.status >= 400 ? anyE.status : 500 });
}

export const itemSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  subcategory: z.string(),
  colors: z.array(z.string()),
  pattern: z.string(),
  material: z.string(),
  seasons: z.array(z.string()),
  formality: z.number(),
  styleTags: z.array(z.string()),
  wearCount: z.number(),
  favorite: z.boolean(),
});

export const contextSchema = z.object({
  styleProfile: z.string().optional(),
  presentation: z.string().optional(),
});
