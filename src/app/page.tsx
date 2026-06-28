"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { NavBar } from "@/components/NavBar";
import { getPendingCount, syncQueue } from "@/lib/offline-queue";

interface RecentMovement {
  id: string;
  type: string;
  qtyDelta: string;
  unit: string;
  serverTime: string;
  bundleCode: string | null;
  productName: string | null;
}

interface InventoryItem {
  product_id: string;
  name: string;
  qty_on_hand: string;
  base_unit: string;
  active_bundles: string;
  reorder_threshold: string | null;
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [activeBundles, setActiveBundles] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const checkPending = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {}
  }, []);

  const doSync = useCallback(async () => {
    if (!user || !isOnline || syncing) return;
    setSyncing(true);
    try {
      await syncQueue(user.id);
      await checkPending();
    } finally {
      setSyncing(false);
    }
  }, [user, isOnline, syncing, checkPending]);

  useEffect(() => {
    if (!user) return;
    checkPending();

    const handleOnline = () => { setIsOnline(true); doSync(); };
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Auto-sync every 30s
    const interval = setInterval(() => {
      if (navigator.onLine) doSync();
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [user, checkPending, doSync]);

  useEffect(() => {
    if (!user) return;
    // Fetch recent movements
    fetch("/api/movements?limit=5")
      .then((r) => r.json())
      .then((d) => setRecentMovements(d.movements || []))
      .catch(() => {});

    // Fetch inventory stats
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => {
        setLowStockCount(d.lowStock?.length || 0);
        setTotalProducts(d.onHand?.length || 0);
        setActiveBundles(
          (d.onHand || []).reduce((s: number, p: InventoryItem) => s + Number(p.active_bundles), 0)
        );
      })
      .catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-orange-500 text-4xl animate-pulse">🔥</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Hey, {user.fullName.split(" ")[0]} 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Online/Offline + sync */}
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={doSync}
                disabled={syncing || !isOnline}
                className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs px-3 py-1.5 rounded-full hover:bg-orange-500/30 transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <span className="animate-spin">↻</span>
                ) : (
                  <span>↑</span>
                )}
                {pendingCount} pending
              </button>
            )}
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full ${
              isOnline ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}`} />
              {isOnline ? "Online" : "Offline"}
            </div>
          </div>
        </div>

        {/* Big Scan Button */}
        <Link
          href="/scan"
          className="block w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xl rounded-2xl py-8 text-center transition-all shadow-lg shadow-orange-500/20 mb-6"
        >
          <div className="text-4xl mb-2">📷</div>
          Scan Bundle
        </Link>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{totalProducts}</div>
            <div className="text-xs text-slate-400 mt-1">Products</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{activeBundles}</div>
            <div className="text-xs text-slate-400 mt-1">Bundles</div>
          </div>
          <div className={`border rounded-xl p-4 text-center ${
            lowStockCount > 0
              ? "bg-red-500/10 border-red-500/30"
              : "bg-slate-900 border-slate-800"
          }`}>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-400" : "text-white"}`}>
              {lowStockCount}
            </div>
            <div className={`text-xs mt-1 ${lowStockCount > 0 ? "text-red-400" : "text-slate-400"}`}>
              Low Stock
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {user.role === "admin" && (
            <Link
              href="/receiving"
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center gap-3 transition-colors"
            >
              <span className="text-2xl">📦</span>
              <div>
                <div className="font-semibold text-white text-sm">Receive Stock</div>
                <div className="text-xs text-slate-400">Create receipt + labels</div>
              </div>
            </Link>
          )}
          <Link
            href="/jobs"
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">📋</span>
            <div>
              <div className="font-semibold text-white text-sm">Jobs</div>
              <div className="text-xs text-slate-400">View packing lists</div>
            </div>
          </Link>
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center gap-3 transition-colors"
            >
              <span className="text-2xl">⚙️</span>
              <div>
                <div className="font-semibold text-white text-sm">Admin</div>
                <div className="text-xs text-slate-400">Products, users, reports</div>
              </div>
            </Link>
          )}
        </div>

        {/* Recent activity */}
        {recentMovements.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="font-semibold text-white text-sm">Recent Activity</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {recentMovements.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white font-medium">
                      {m.productName || "Unknown"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {m.bundleCode} · {m.type}
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${
                    Number(m.qtyDelta) < 0 ? "text-red-400" : "text-green-400"
                  }`}>
                    {Number(m.qtyDelta) > 0 ? "+" : ""}{m.qtyDelta} {m.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
