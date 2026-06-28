import { NextRequest, NextResponse } from "next/server";
import { db, products } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const { sku, name, category, baseUnit, piecesPerBundle, reorderThreshold } = body;

    await db.update(products).set({
      sku: sku?.trim().toUpperCase(),
      name: name?.trim(),
      category: category?.trim() || null,
      baseUnit: baseUnit || "piece",
      piecesPerBundle: piecesPerBundle ? String(piecesPerBundle) : null,
      reorderThreshold: reorderThreshold ? String(reorderThreshold) : null,
    }).where(eq(products.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update product error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await params;
    await db.delete(products).where(eq(products.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete product error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
