import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── USERS ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("crew"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── CUSTOMERS ────────────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ref: text("ref"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").unique().notNull(),
  name: text("name").notNull(),
  category: text("category"),
  baseUnit: text("base_unit").notNull().default("piece"),
  piecesPerBundle: numeric("pieces_per_bundle"),
  reorderThreshold: numeric("reorder_threshold"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── RECEIPTS ─────────────────────────────────────────────────────────────────
export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").unique().notNull(),
  supplier: text("supplier"),
  poNumber: text("po_number"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receiptLines = pgTable("receipt_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptId: uuid("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  qtyPerBundle: numeric("qty_per_bundle").notNull(),
  bundleCount: integer("bundle_count").notNull(),
  unit: text("unit").notNull().default("piece"),
});

// ── BUNDLES ──────────────────────────────────────────────────────────────────
export const bundles = pgTable("bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").unique().notNull(),
  productId: uuid("product_id").notNull().references(() => products.id),
  unit: text("unit").notNull().default("piece"),
  qtyReceived: numeric("qty_received").notNull(),
  qtyRemaining: numeric("qty_remaining").notNull(),
  location: text("location"),
  status: text("status").notNull().default("active"),
  receiptId: uuid("receipt_id").references(() => receipts.id),
  receivedBy: uuid("received_by").references(() => users.id),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_bundles_product").on(t.productId),
  index("idx_bundles_status").on(t.status),
  index("idx_bundles_code").on(t.code),
]);

// ── JOBS ─────────────────────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(),
  customerRef: text("customer_ref"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (t) => [
  index("idx_jobs_customer").on(t.customerId),
]);

// ── MOVEMENTS ────────────────────────────────────────────────────────────────
export const movements = pgTable("movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientUuid: text("client_uuid").unique().notNull(),
  bundleId: uuid("bundle_id").notNull().references(() => bundles.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  type: text("type").notNull(),
  qtyDelta: numeric("qty_delta").notNull(),
  unit: text("unit").notNull(),
  jobId: uuid("job_id").references(() => jobs.id),
  employeeId: uuid("employee_id").notNull().references(() => users.id),
  deviceId: text("device_id"),
  deviceTime: timestamp("device_time", { withTimezone: true }).notNull(),
  serverTime: timestamp("server_time", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_mov_bundle").on(t.bundleId),
  index("idx_mov_job").on(t.jobId),
  index("idx_mov_employee").on(t.employeeId),
  index("idx_mov_server_time").on(t.serverTime),
]);

// ── RELATIONS ─────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  movements: many(movements),
  jobs: many(jobs),
  receipts: many(receipts),
  bundles: many(bundles),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  jobs: many(jobs),
}));

export const productsRelations = relations(products, ({ many }) => ({
  bundles: many(bundles),
  movements: many(movements),
  receiptLines: many(receiptLines),
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  createdBy: one(users, { fields: [receipts.createdBy], references: [users.id] }),
  lines: many(receiptLines),
  bundles: many(bundles),
}));

export const receiptLinesRelations = relations(receiptLines, ({ one }) => ({
  receipt: one(receipts, { fields: [receiptLines.receiptId], references: [receipts.id] }),
  product: one(products, { fields: [receiptLines.productId], references: [products.id] }),
}));

export const bundlesRelations = relations(bundles, ({ one, many }) => ({
  product: one(products, { fields: [bundles.productId], references: [products.id] }),
  receipt: one(receipts, { fields: [bundles.receiptId], references: [receipts.id] }),
  receivedBy: one(users, { fields: [bundles.receivedBy], references: [users.id] }),
  movements: many(movements),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  customer: one(customers, { fields: [jobs.customerId], references: [customers.id] }),
  createdBy: one(users, { fields: [jobs.createdBy], references: [users.id] }),
  movements: many(movements),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  bundle: one(bundles, { fields: [movements.bundleId], references: [bundles.id] }),
  product: one(products, { fields: [movements.productId], references: [products.id] }),
  job: one(jobs, { fields: [movements.jobId], references: [jobs.id] }),
  employee: one(users, { fields: [movements.employeeId], references: [users.id] }),
}));
