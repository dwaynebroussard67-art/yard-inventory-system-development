import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", service: "forge-load" });
  } catch (err) {
    console.error("Health check failed:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
