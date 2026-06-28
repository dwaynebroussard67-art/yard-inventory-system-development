import { NextResponse } from "next/server";
import { db, users, products, customers } from "@/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    // Create sequences for code generation
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS bundle_code_seq START 1`);
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS job_code_seq START 1`);
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS receipt_code_seq START 1`);

    // Create admin user if not exists
    const adminEmail = "admin@forgeload.com";
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`email = ${adminEmail}`)
      .limit(1);

    if (!existing) {
      const passwordHash = await bcrypt.hash("admin123", 10);
      await db.insert(users).values({
        email: adminEmail,
        passwordHash,
        fullName: "Admin User",
        role: "admin",
      });
    }

    // Create demo crew user if not exists
    const crewEmail = "crew@forgeload.com";
    const [existingCrew] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`email = ${crewEmail}`)
      .limit(1);

    if (!existingCrew) {
      const passwordHash = await bcrypt.hash("crew123", 10);
      await db.insert(users).values({
        email: crewEmail,
        passwordHash,
        fullName: "Crew Member",
        role: "crew",
      });
    }

    // Seed some products
    const productCount = await db.execute(sql`SELECT COUNT(*) as c FROM products`);
    if (Number((productCount.rows[0] as { c: string }).c) === 0) {
      await db.insert(products).values([
        {
          sku: "CED-6FT-PRI",
          name: "6ft Cedar Privacy Picket",
          category: "Fencing",
          baseUnit: "piece",
          piecesPerBundle: "200",
          reorderThreshold: "500",
        },
        {
          sku: "PT-4X4-8",
          name: "4x4x8 Pressure Treated Post",
          category: "Posts",
          baseUnit: "piece",
          piecesPerBundle: "50",
          reorderThreshold: "100",
        },
        {
          sku: "CED-2X4-8",
          name: "2x4x8 Cedar Rail",
          category: "Rails",
          baseUnit: "piece",
          piecesPerBundle: "100",
          reorderThreshold: "200",
        },
        {
          sku: "SCRW-1.5-GV",
          name: '1.5" Galvanized Screw (box)',
          category: "Hardware",
          baseUnit: "bundle",
          piecesPerBundle: "1",
          reorderThreshold: "10",
        },
      ]);
    }

    // Seed a customer
    const custCount = await db.execute(sql`SELECT COUNT(*) as c FROM customers`);
    if (Number((custCount.rows[0] as { c: string }).c) === 0) {
      await db.insert(customers).values([
        { name: "Acme Construction", ref: "ACME-001", phone: "555-0100" },
        { name: "Green Valley Homes", ref: "GVH-042", phone: "555-0142" },
      ]);
    }

    return NextResponse.json({ ok: true, message: "Setup complete" });
  } catch (err) {
    console.error("Setup error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
