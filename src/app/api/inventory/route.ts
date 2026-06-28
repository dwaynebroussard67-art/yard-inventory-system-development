import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // On-hand summary per product
    const onHand = await db.execute(sql`
      SELECT 
        p.id as product_id,
        p.sku,
        p.name,
        p.category,
        p.base_unit,
        p.reorder_threshold,
        COALESCE(SUM(b.qty_remaining) FILTER (WHERE b.status = 'active'), 0) as qty_on_hand,
        COUNT(b.id) FILTER (WHERE b.status = 'active') as active_bundles
      FROM products p
      LEFT JOIN bundles b ON b.product_id = p.id
      GROUP BY p.id, p.sku, p.name, p.category, p.base_unit, p.reorder_threshold
      ORDER BY p.name
    `);

    // Low stock
    const lowStock = onHand.rows.filter(
      (row: Record<string, unknown>) =>
        row.reorder_threshold !== null &&
        Number(row.qty_on_hand) <= Number(row.reorder_threshold)
    );

    return NextResponse.json({ onHand: onHand.rows, lowStock });
  } catch (err) {
    console.error("Inventory error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
