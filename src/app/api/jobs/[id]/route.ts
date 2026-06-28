import { NextRequest, NextResponse } from "next/server";
import { db, jobs, movements, bundles, products, users } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    // Support lookup by code or UUID
    const isUuid = /^[0-9a-f-]{36}$/i.test(id);
    const whereClause = isUuid ? eq(jobs.id, id) : eq(jobs.code, id);

    const [job] = await db.select().from(jobs).where(whereClause).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get packing list
    const packingList = await db
      .select({
        movementId: movements.id,
        type: movements.type,
        qtyDelta: movements.qtyDelta,
        unit: movements.unit,
        deviceTime: movements.deviceTime,
        serverTime: movements.serverTime,
        note: movements.note,
        bundleId: bundles.id,
        bundleCode: bundles.code,
        productName: products.name,
        productSku: products.sku,
        employeeName: users.fullName,
      })
      .from(movements)
      .leftJoin(bundles, eq(movements.bundleId, bundles.id))
      .leftJoin(products, eq(movements.productId, products.id))
      .leftJoin(users, eq(movements.employeeId, users.id))
      .where(eq(movements.jobId, job.id));

    return NextResponse.json({ job, packingList });
  } catch (err) {
    console.error("Get job error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
    const { status, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (status === "closed") updateData.closedAt = new Date();

    await db.update(jobs).set(updateData).where(eq(jobs.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update job error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
