import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { bundles, products, jobs, movements, users } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "get_on_hand",
    description: "Get current on-hand quantity per product. Optional case-insensitive name/sku filter.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "optional product name or sku filter" },
      },
    },
  },
  {
    name: "low_stock",
    description: "List products currently below their reorder threshold.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "find_bundle",
    description: "Look up a single bundle by its code (e.g. BND-2026-000123).",
    input_schema: {
      type: "object" as const,
      properties: { code: { type: "string" } },
      required: ["code"],
    },
  },
  {
    name: "job_summary",
    description: "Summarize everything pulled for a job by its code (e.g. JOB-2026-0042).",
    input_schema: {
      type: "object" as const,
      properties: { job_code: { type: "string" } },
      required: ["job_code"],
    },
  },
  {
    name: "recent_activity",
    description: "Get recent movements/activity in the yard.",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "number of recent records, default 10" } },
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_on_hand": {
      const result = await db.execute(sql`
        SELECT p.id, p.sku, p.name, p.category, p.base_unit,
               COALESCE(SUM(b.qty_remaining) FILTER (WHERE b.status = 'active'), 0) as qty_on_hand,
               COUNT(b.id) FILTER (WHERE b.status = 'active') as active_bundles
        FROM products p
        LEFT JOIN bundles b ON b.product_id = p.id
        ${input.query ? sql`WHERE p.name ILIKE ${'%' + String(input.query) + '%'} OR p.sku ILIKE ${'%' + String(input.query) + '%'}` : sql``}
        GROUP BY p.id, p.sku, p.name, p.category, p.base_unit
        ORDER BY p.name
      `);
      return result.rows;
    }
    case "low_stock": {
      const result = await db.execute(sql`
        SELECT p.id, p.sku, p.name, p.category, p.reorder_threshold, p.base_unit,
               COALESCE(SUM(b.qty_remaining) FILTER (WHERE b.status = 'active'), 0) as qty_on_hand
        FROM products p
        LEFT JOIN bundles b ON b.product_id = p.id
        WHERE p.reorder_threshold IS NOT NULL
        GROUP BY p.id, p.sku, p.name, p.category, p.reorder_threshold, p.base_unit
        HAVING COALESCE(SUM(b.qty_remaining) FILTER (WHERE b.status = 'active'), 0) <= p.reorder_threshold
        ORDER BY p.name
      `);
      return result.rows;
    }
    case "find_bundle": {
      const result = await db
        .select({
          id: bundles.id,
          code: bundles.code,
          status: bundles.status,
          location: bundles.location,
          qtyRemaining: bundles.qtyRemaining,
          qtyReceived: bundles.qtyReceived,
          unit: bundles.unit,
          productName: products.name,
          productSku: products.sku,
        })
        .from(bundles)
        .leftJoin(products, eq(bundles.productId, products.id))
        .where(eq(bundles.code, String(input.code)))
        .limit(1);
      return result[0] ?? { error: "not found" };
    }
    case "job_summary": {
      const [job] = await db.select().from(jobs).where(eq(jobs.code, String(input.job_code))).limit(1);
      if (!job) return { error: "Job not found" };

      const pulls = await db.execute(sql`
        SELECT p.name as product_name, p.sku, ABS(m.qty_delta) as qty_pulled, m.unit,
               u.full_name as pulled_by, m.server_time, b.code as bundle_code
        FROM movements m
        JOIN bundles b ON b.id = m.bundle_id
        JOIN products p ON p.id = m.product_id
        JOIN users u ON u.id = m.employee_id
        WHERE m.job_id = ${job.id} AND m.type = 'pull'
        ORDER BY m.server_time
      `);
      return { job: { code: job.code, customer: job.customerName, status: job.status }, pulls: pulls.rows };
    }
    case "recent_activity": {
      const limit = Math.min(Number(input.limit) || 10, 50);
      const result = await db
        .select({
          id: movements.id,
          type: movements.type,
          qtyDelta: movements.qtyDelta,
          unit: movements.unit,
          serverTime: movements.serverTime,
          bundleCode: bundles.code,
          productName: products.name,
          employeeName: users.fullName,
        })
        .from(movements)
        .leftJoin(bundles, eq(movements.bundleId, bundles.id))
        .leftJoin(products, eq(movements.productId, products.id))
        .leftJoin(users, eq(movements.employeeId, users.id))
        .orderBy(desc(movements.serverTime))
        .limit(limit);
      return result;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM = `You are the yard assistant for Forge Load — a building-materials yard inventory system.
Answer ONLY from tool results — never invent quantities or bundle codes. Be brief and concrete.
You are READ-ONLY: if asked to change inventory (pull, receive, adjust), refuse and explain that 
all inventory changes must go through the scan flow in the app.
Units matter; always include them in your answers.
When listing products, include their quantities and units clearly.`;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI assistant not configured" }, { status: 503 });
    }

    const { messages } = await req.json();
    const conv: Anthropic.MessageParam[] = messages;

    for (let i = 0; i < 5; i++) {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM,
        tools,
        messages: conv,
      });

      if (res.stop_reason === "tool_use") {
        conv.push({ role: "assistant", content: res.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of res.content) {
          if (block.type === "tool_use") {
            const out = await runTool(block.name, block.input as Record<string, unknown>);
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(out),
            });
          }
        }
        conv.push({ role: "user", content: results });
        continue;
      }

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return NextResponse.json({ answer: text });
    }

    return NextResponse.json({ answer: "Sorry — couldn't complete that. Try rephrasing." });
  } catch (err) {
    console.error("Assistant error:", err);
    return NextResponse.json({ error: "Assistant error" }, { status: 500 });
  }
}
