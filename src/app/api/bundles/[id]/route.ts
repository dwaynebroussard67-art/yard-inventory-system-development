import { NextRequest, NextResponse } from "next/server";
import { db, bundles, products, movements, users, jobs } from "@/db";
import { eq, desc } from "drizzle-orm";
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
    const whereClause = isUuid ? eq(bundles.id, id) : eq(bundles.code, id);

    const [bundle] = await db
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
        piecesPerBundle: products.piecesPerBundle,
      })
      .from(bundles)
      .leftJoin(products, eq(bundles.productId, products.id))
      .where(whereClause)
      .limit(1);

    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Get movement history
    const movementHistory = await db
      .select({
        id: movements.id,
        type: movements.type,
        qtyDelta: movements.qtyDelta,
        unit: movements.unit,
        deviceTime: movements.deviceTime,
        serverTime: movements.serverTime,
        note: movements.note,
        employeeName: users.fullName,
        jobCode: jobs.code,
        jobCustomerName: jobs.customerName,
      })
      .from(movements)
      .leftJoin(users, eq(movements.employeeId, users.id))
      .leftJoin(jobs, eq(movements.jobId, jobs.id))
      .where(eq(movements.bundleId, bundle.id))
      .orderBy(desc(movements.serverTime))
      .limit(50);

    return NextResponse.json({ bundle, movements: movementHistory });
  } catch (err) {
    console.error("Get bundle error:", err);
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
    const { location } = body;

    await db.update(bundles).set({ location }).where(eq(bundles.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update bundle error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
