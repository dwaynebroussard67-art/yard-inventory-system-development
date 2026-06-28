import { NextRequest, NextResponse } from "next/server";
import { db, customers } from "@/db";
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
    const { name, ref, phone, active } = await req.json();
    await db.update(customers).set({
      name: name?.trim(),
      ref: ref?.trim() || null,
      phone: phone?.trim() || null,
      active: active !== undefined ? active : true,
    }).where(eq(customers.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update customer error:", err);
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
    // Soft-delete
    await db.update(customers).set({ active: false }).where(eq(customers.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete customer error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
