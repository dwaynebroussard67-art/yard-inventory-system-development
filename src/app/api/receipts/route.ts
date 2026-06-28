import { NextRequest, NextResponse } from "next/server";
import { db, receipts, receiptLines, bundles, products, movements } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { nextBundleCode, nextReceiptCode } from "@/lib/codes";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(receipts)
      .orderBy(desc(receipts.createdAt))
      .limit(100);

    return NextResponse.json({ receipts: rows });
  } catch (err) {
    console.error("Get receipts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { supplier, poNumber, notes, lines } = body;
    // lines: [{ productId, qtyPerBundle, bundleCount, unit }]

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: "At least one line required" }, { status: 400 });
    }

    const code = await nextReceiptCode();

    // Create receipt
    const [receipt] = await db.insert(receipts).values({
      code,
      supplier: supplier?.trim() || null,
      poNumber: poNumber?.trim() || null,
      notes: notes?.trim() || null,
      status: "received",
      createdBy: session.id,
    }).returning();

    const generatedBundles: {
      id: string;
      code: string;
      productId: string;
      productName: string | null;
      qtyReceived: number;
      unit: string;
    }[] = [];

    // For each line, generate bundles
    for (const line of lines) {
      const { productId, qtyPerBundle, bundleCount, unit } = line;

      // Verify product
      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product) continue;

      // Insert receipt line
      await db.insert(receiptLines).values({
        receiptId: receipt.id,
        productId,
        qtyPerBundle: String(qtyPerBundle),
        bundleCount: Number(bundleCount),
        unit: unit || product.baseUnit || "piece",
      });

      // Generate each bundle + receive movement
      for (let i = 0; i < Number(bundleCount); i++) {
        const bundleCode = await nextBundleCode();
        const [bundle] = await db.insert(bundles).values({
          code: bundleCode,
          productId,
          unit: unit || product.baseUnit || "piece",
          qtyReceived: String(qtyPerBundle),
          qtyRemaining: String(qtyPerBundle),
          status: "active",
          receiptId: receipt.id,
          receivedBy: session.id,
        }).returning();

        // Write receive movement
        await db.insert(movements).values({
          clientUuid: uuidv4(),
          bundleId: bundle.id,
          productId,
          type: "receive",
          qtyDelta: String(qtyPerBundle),
          unit: unit || product.baseUnit || "piece",
          employeeId: session.id,
          deviceTime: new Date(),
          note: `Receipt ${code}`,
        });

        generatedBundles.push({
          id: bundle.id,
          code: bundle.code,
          productId,
          productName: product.name,
          qtyReceived: Number(qtyPerBundle),
          unit: unit || product.baseUnit || "piece",
        });
      }
    }

    return NextResponse.json({ receipt, bundles: generatedBundles }, { status: 201 });
  } catch (err) {
    console.error("Create receipt error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
