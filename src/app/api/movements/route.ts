import { NextRequest, NextResponse } from "next/server";
import { db, movements, bundles, products } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      clientUuid,
      bundleId,
      productId,
      type,
      qtyDelta,
      unit,
      jobId,
      employeeId,
      deviceId,
      deviceTime,
      note,
    } = body;

    if (!clientUuid || !bundleId || !productId || !type || qtyDelta === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check bundle exists and is not retired
    const [bundle] = await db.select().from(bundles).where(eq(bundles.id, bundleId)).limit(1);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    if (bundle.status === "retired") {
      return NextResponse.json({ error: "Bundle is retired; no further movements allowed" }, { status: 422 });
    }

    // Check would not go negative
    const currentQty = Number(bundle.qtyRemaining);
    const delta = Number(qtyDelta);
    if (currentQty + delta < 0) {
      return NextResponse.json(
        { error: `Movement would make bundle negative (current: ${currentQty}, delta: ${delta})` },
        { status: 422 }
      );
    }

    // Insert movement (trigger will update bundle)
    try {
      await db.insert(movements).values({
        clientUuid,
        bundleId,
        productId,
        type,
        qtyDelta: String(qtyDelta),
        unit: unit || bundle.unit,
        jobId: jobId || null,
        employeeId: employeeId || session.id,
        deviceId: deviceId || null,
        deviceTime: deviceTime ? new Date(deviceTime) : new Date(),
        note: note || null,
      });
    } catch (err: unknown) {
      // Idempotency: if duplicate client_uuid, treat as success
      if (err instanceof Error && err.message.includes("unique")) {
        return NextResponse.json({ ok: true, idempotent: true }, { status: 200 });
      }
      throw err;
    }

    // Update bundle qty_remaining and status manually (trigger equivalent in app layer)
    const newQty = currentQty + delta;
    const newStatus = newQty === 0 ? "retired" : bundle.status;
    await db.update(bundles)
      .set({ qtyRemaining: String(newQty), status: newStatus })
      .where(eq(bundles.id, bundleId));

    // Fetch updated bundle
    const [updatedBundle] = await db
      .select({ qtyRemaining: bundles.qtyRemaining, status: bundles.status })
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    return NextResponse.json({ ok: true, bundle: updatedBundle });
  } catch (err) {
    console.error("Movement error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const rows = await db
      .select({
        id: movements.id,
        clientUuid: movements.clientUuid,
        type: movements.type,
        qtyDelta: movements.qtyDelta,
        unit: movements.unit,
        deviceTime: movements.deviceTime,
        serverTime: movements.serverTime,
        note: movements.note,
        bundleCode: bundles.code,
        productName: products.name,
      })
      .from(movements)
      .leftJoin(bundles, eq(movements.bundleId, bundles.id))
      .leftJoin(products, eq(movements.productId, products.id))
      .orderBy(desc(movements.serverTime))
      .limit(limit);

    return NextResponse.json({ movements: rows });
  } catch (err) {
    console.error("Get movements error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
