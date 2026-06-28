import { NextRequest, NextResponse } from "next/server";
import { db, products } from "@/db";
import { eq, asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.select().from(products).orderBy(asc(products.name));
    return NextResponse.json({ products: rows });
  } catch (err) {
    console.error("Get products error:", err);
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
    const { sku, name, category, baseUnit, piecesPerBundle, reorderThreshold } = body;

    if (!sku || !name) {
      return NextResponse.json({ error: "SKU and name required" }, { status: 400 });
    }

    const [product] = await db
      .insert(products)
      .values({
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category: category?.trim() || null,
        baseUnit: baseUnit || "piece",
        piecesPerBundle: piecesPerBundle ? String(piecesPerBundle) : null,
        reorderThreshold: reorderThreshold ? String(reorderThreshold) : null,
      })
      .returning();

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    }
    console.error("Create product error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
