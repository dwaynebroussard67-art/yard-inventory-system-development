import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const rows = await db
      .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, active: users.active, createdAt: users.createdAt })
      .from(users)
      .orderBy(asc(users.fullName));
    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("Get users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { email, password, fullName, role } = await req.json();
    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Email, password, and name required" }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName: fullName.trim(),
      role: role || "crew",
    }).returning({ id: users.id, email: users.email, fullName: users.fullName, role: users.role });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
