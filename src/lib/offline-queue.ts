"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";
import { v4 as uuidv4 } from "uuid";

export interface QueuedMovement {
  clientUuid: string;
  bundleId: string;
  productId: string;
  type: "receive" | "pull" | "return" | "adjust" | "count_correction";
  qtyDelta: number;
  unit: string;
  jobId?: string;
  employeeId: string;
  deviceId: string;
  deviceTime: string;
  note?: string;
  createdAt: string;
  syncStatus: "pending" | "syncing" | "synced" | "error";
  errorMessage?: string;
  retryCount: number;
}

interface ForgeLoadDB extends DBSchema {
  movementQueue: {
    key: string;
    value: QueuedMovement;
    indexes: { "by-sync-status": string; "by-created-at": string };
  };
}

let dbPromise: Promise<IDBPDatabase<ForgeLoadDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ForgeLoadDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ForgeLoadDB>("forge-load-v1", 1, {
      upgrade(db) {
        const store = db.createObjectStore("movementQueue", { keyPath: "clientUuid" });
        store.createIndex("by-sync-status", "syncStatus");
        store.createIndex("by-created-at", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function enqueueMovement(
  movement: Omit<QueuedMovement, "clientUuid" | "createdAt" | "syncStatus" | "retryCount">
): Promise<string> {
  const db = await getDB();
  const clientUuid = uuidv4();
  const entry: QueuedMovement = {
    ...movement,
    clientUuid,
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
    retryCount: 0,
  };
  await db.put("movementQueue", entry);
  return clientUuid;
}

export async function getPendingMovements(): Promise<QueuedMovement[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("movementQueue", "by-sync-status", "pending");
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingMovements();
  return pending.length;
}

export async function markSynced(clientUuid: string): Promise<void> {
  const db = await getDB();
  const entry = await db.get("movementQueue", clientUuid);
  if (entry) {
    entry.syncStatus = "synced";
    await db.put("movementQueue", entry);
  }
}

export async function markError(clientUuid: string, errorMessage: string): Promise<void> {
  const db = await getDB();
  const entry = await db.get("movementQueue", clientUuid);
  if (entry) {
    entry.syncStatus = "error";
    entry.errorMessage = errorMessage;
    entry.retryCount = (entry.retryCount || 0) + 1;
    if (entry.retryCount < 5) {
      entry.syncStatus = "pending";
    }
    await db.put("movementQueue", entry);
  }
}

export async function markSyncing(clientUuid: string): Promise<void> {
  const db = await getDB();
  const entry = await db.get("movementQueue", clientUuid);
  if (entry) {
    entry.syncStatus = "syncing";
    await db.put("movementQueue", entry);
  }
}

export async function syncQueue(employeeId: string): Promise<{ synced: number; errors: number }> {
  const pending = await getPendingMovements();
  let synced = 0;
  let errors = 0;

  for (const movement of pending) {
    try {
      await markSyncing(movement.clientUuid);
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movement),
      });

      if (response.ok) {
        await markSynced(movement.clientUuid);
        synced++;
      } else {
        const error = await response.json();
        // If it's a 409 (already exists = idempotent), mark as synced
        if (response.status === 409) {
          await markSynced(movement.clientUuid);
          synced++;
        } else {
          await markError(movement.clientUuid, error.error || "Unknown error");
          errors++;
        }
      }
    } catch (err) {
      await markError(movement.clientUuid, err instanceof Error ? err.message : "Network error");
      errors++;
    }
  }

  return { synced, errors };
}

export function generateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let deviceId = localStorage.getItem("forge_device_id");
  if (!deviceId) {
    deviceId = `dev-${uuidv4().slice(0, 8)}`;
    localStorage.setItem("forge_device_id", deviceId);
  }
  return deviceId;
}
