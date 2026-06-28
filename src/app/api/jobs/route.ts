import { NextRequest, NextResponse } from "next/server";
import { db, jobs, customers } from "@/db";
import { eq, desc, asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { nextJobCode } from "@/lib/codes";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: jobs.id,
        code: jobs.code,
        customerName: jobs.customerName,
        customerRef: jobs.customerRef,
        status: jobs.status,
        notes: jobs.notes,
        createdAt: jobs.createdAt,
        closedAt: jobs.closedAt,
        customerId: jobs.customerId,
      })
      .from(jobs)
      .orderBy(desc(jobs.createdAt))
      .limit(200);

    return NextResponse.json({ jobs: rows });
  } catch (err) {
    console.error("Get jobs error:", err);
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
    const { customerId, customerRef, notes, status } = body;

    if (!customerId) {
      return NextResponse.json({ error: "Customer required" }, { status: 400 });
    }

    // Look up customer
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const code = await nextJobCode();

    const [job] = await db.insert(jobs).values({
      code,
      customerId,
      customerName: customer.name,
      customerRef: customerRef?.trim() || null,
      notes: notes?.trim() || null,
      status: status || "open",
      createdBy: session.id,
    }).returning();

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    console.error("Create job error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
