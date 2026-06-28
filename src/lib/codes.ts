import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function nextBundleCode(): Promise<string> {
  const result = await db.execute(
    sql`SELECT nextval('bundle_code_seq') AS n`
  );
  const n = String((result.rows[0] as { n: string | number }).n).padStart(6, "0");
  const year = new Date().getFullYear();
  return `BND-${year}-${n}`;
}

export async function nextJobCode(): Promise<string> {
  const result = await db.execute(
    sql`SELECT nextval('job_code_seq') AS n`
  );
  const n = String((result.rows[0] as { n: string | number }).n).padStart(4, "0");
  const year = new Date().getFullYear();
  return `JOB-${year}-${n}`;
}

export async function nextReceiptCode(): Promise<string> {
  const result = await db.execute(
    sql`SELECT nextval('receipt_code_seq') AS n`
  );
  const n = String((result.rows[0] as { n: string | number }).n).padStart(4, "0");
  const year = new Date().getFullYear();
  return `RCP-${year}-${n}`;
}
