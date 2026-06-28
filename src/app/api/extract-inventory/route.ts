import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACT_PROMPT = `Extract the line items from this inventory/order sheet.
Return ONLY a JSON array, no prose, no markdown fences. Each element:
{ "description": string, "qty_per_bundle": number|null, "bundle_count": number|null, "unit": string|null }
If a value is unreadable, use null. Do not guess values you cannot see.
"unit" should be one of: piece, linear_ft, board_ft, bundle — or null if unclear.`;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const { image_base64, media_type } = await req.json();
    if (!image_base64 || !media_type) {
      return NextResponse.json({ error: "image_base64 and media_type required" }, { status: 400 });
    }

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: image_base64,
              },
            },
            { type: "text", text: EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let rows: unknown[] = [];
    try {
      rows = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      return NextResponse.json(
        { error: "Could not parse sheet. Try a clearer photo." },
        { status: 422 }
      );
    }

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("Extract inventory error:", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
