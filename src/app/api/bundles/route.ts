import { NextRequest, NextResponse } from "next/server";
import { db, bundles, products } from "@/db";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const conditions = [];
    if (status) {
      conditions.push(eq(bundles.status, status));
    }

    let query = db
      .select({
        id: bundles.id,
        code: bundles.code,
        unit: bundles.unit,
        qtyReceived: bundles.qtyReceived,
        qtyRemaining: bundles.qtyRemaining,
        location: bundles.location,
        status: bundles.status,
        receivedAt: bundles.receivedAt,
        productId: bundles.productId,
        productName: products.name,
        productSku: products.sku,
        productCategory: products.category,
      })
      .from(bundles)
      .leftJoin(products, eq(bundles.productId, products.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(bundles.createdAt)).limit(200);

    // Filter by search client-side (for simplicity)
    const filtered = search
      ? rows.filter(
          (b) =>
            b.code.toLowerCase().includes(search.toLowerCase()) ||
            b.productName?.toLowerCase().includes(search.toLowerCase()) ||
            b.location?.toLowerCase().includes(search.toLowerCase())
        )
      : rows;

    return NextResponse.json({ bundles: filtered });
  } catch (err) {
    console.error("Get bundles error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
