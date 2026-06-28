import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createToken, SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user || !user.active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as "admin" | "crew",
    };
    const token = await createToken(sessionUser);

    const response = NextResponse.json({ user: sessionUser });
    response.cookies.set("forge_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
