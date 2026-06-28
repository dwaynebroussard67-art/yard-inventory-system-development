import { NextRequest, NextResponse } from "next/server";
import { db, receipts, receiptLines, bundles, products } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await params;

    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id)).limit(1);
    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    const lines = await db
      .select({
        id: receiptLines.id,
        qtyPerBundle: receiptLines.qtyPerBundle,
        bundleCount: receiptLines.bundleCount,
        unit: receiptLines.unit,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
      })
      .from(receiptLines)
      .leftJoin(products, eq(receiptLines.productId, products.id))
      .where(eq(receiptLines.receiptId, id));

    const bundleRows = await db
      .select({
        id: bundles.id,
        code: bundles.code,
        qtyReceived: bundles.qtyReceived,
        qtyRemaining: bundles.qtyRemaining,
        status: bundles.status,
        location: bundles.location,
        productId: bundles.productId,
        productName: products.name,
      })
      .from(bundles)
      .leftJoin(products, eq(bundles.productId, products.id))
      .where(eq(bundles.receiptId, id));

    return NextResponse.json({ receipt, lines, bundles: bundleRows });
  } catch (err) {
    console.error("Get receipt error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
