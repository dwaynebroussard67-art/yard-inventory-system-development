import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "forge-load-secret-key-change-in-production"
);

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "crew";
}

export async function createToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("forge_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new Error("Forbidden: admin only");
  }
  return session;
}

export async function getUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}
