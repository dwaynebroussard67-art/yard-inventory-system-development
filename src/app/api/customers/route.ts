import { NextRequest, NextResponse } from "next/server";
import { db, customers } from "@/db";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await db.select().from(customers).orderBy(asc(customers.name));
    return NextResponse.json({ customers: rows });
  } catch (err) {
    console.error("Get customers error:", err);
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
    const { name, ref, phone } = body;
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const [customer] = await db.insert(customers).values({
      name: name.trim(),
      ref: ref?.trim() || null,
      phone: phone?.trim() || null,
    }).returning();

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    console.error("Create customer error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
