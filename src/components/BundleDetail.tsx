"use client";

import { useEffect, useState } from "react";
import { enqueueMovement, generateDeviceId } from "@/lib/offline-queue";
import { AuthUser } from "@/hooks/useAuth";

interface Bundle {
  id: string;
  code: string;
  unit: string;
  qtyReceived: string;
  qtyRemaining: string;
  location: string | null;
  status: string;
  productName: string | null;
  productSku: string | null;
  productCategory: string | null;
}

interface Movement {
  id: string;
  type: string;
  qtyDelta: string;
  unit: string;
  serverTime: string;
  note: string | null;
  employeeName: string | null;
  jobCode: string | null;
  jobCustomerName: string | null;
}

interface Job {
  id: string;
  code: string;
  customerName: string;
  status: string;
}

type FlowState = "detail" | "pull" | "return" | "adjust" | "success";

interface Props {
  bundleId: string;
  user: AuthUser;
  onBack: () => void;
}

export function BundleDetail({ bundleId, user, onBack }: Props) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [flowState, setFlowState] = useState<FlowState>("detail");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/bundles/${bundleId}`)
      .then((r) => r.json())
      .then((d) => {
        setBundle(d.bundle);
        setMovements(d.movements || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bundleId]);

  useEffect(() => {
    if (flowState === "pull") {
      fetch("/api/jobs")
        .then((r) => r.json())
        .then((d) => {
          const open = (d.jobs || []).filter((j: Job) => j.status !== "closed");
          setJobs(open);
        })
        .catch(() => {});
    }
  }, [flowState]);

  const handlePull = async () => {
    if (!bundle) return;
    if (!selectedJobId) {
      setError("Please select a job");
      return;
    }
    if (qty <= 0) {
      setError("Quantity must be positive");
      return;
    }
    if (qty > Number(bundle.qtyRemaining)) {
      setError(`Cannot pull more than ${bundle.qtyRemaining} ${bundle.unit}(s) remaining`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const deviceId = generateDeviceId();
      const clientUuid = await enqueueMovement({
        bundleId: bundle.id,
        productId: "",
        type: "pull",
        qtyDelta: -qty,
        unit: bundle.unit,
        jobId: selectedJobId,
        employeeId: user.id,
        deviceId,
        deviceTime: new Date().toISOString(),
        note: note || undefined,
      });

      // Try to sync immediately
      try {
        const res = await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientUuid,
            bundleId: bundle.id,
            productId: bundle.productSku || bundle.id,
            type: "pull",
            qtyDelta: -qty,
            unit: bundle.unit,
            jobId: selectedJobId,
            employeeId: user.id,
            deviceId,
            deviceTime: new Date().toISOString(),
            note: note || null,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Update local bundle
          setBundle((prev) =>
            prev
              ? {
                  ...prev,
                  qtyRemaining: String(Number(prev.qtyRemaining) - qty),
                  status: Number(prev.qtyRemaining) - qty === 0 ? "retired" : prev.status,
                }
              : prev
          );
        }
      } catch {
        // Offline — queued, will sync later
      }

      setSuccessMsg(`✅ Pulled ${qty} ${bundle.unit}(s) — ${navigator.onLine ? "synced" : "queued for sync"}`);
      setFlowState("success");
    } catch (err) {
      setError("Failed to record pull. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!bundle) return;
    if (qty <= 0) {
      setError("Quantity must be positive");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const deviceId = generateDeviceId();
      const clientUuid = await enqueueMovement({
        bundleId: bundle.id,
        productId: "",
        type: "return",
        qtyDelta: qty,
        unit: bundle.unit,
        employeeId: user.id,
        deviceId,
        deviceTime: new Date().toISOString(),
        note: note || undefined,
      });

      try {
        await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientUuid,
            bundleId: bundle.id,
            productId: bundle.id,
            type: "return",
            qtyDelta: qty,
            unit: bundle.unit,
            employeeId: user.id,
            deviceId,
            deviceTime: new Date().toISOString(),
            note: note || null,
          }),
        });
        setBundle((prev) =>
          prev ? { ...prev, qtyRemaining: String(Number(prev.qtyRemaining) + qty) } : prev
        );
      } catch {}

      setSuccessMsg(`✅ Returned ${qty} ${bundle.unit}(s)`);
      setFlowState("success");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjust = async () => {
    if (!bundle) return;
    setSubmitting(true);
    setError("");

    const delta = qty; // positive or negative
    try {
      const deviceId = generateDeviceId();
      const clientUuid = await enqueueMovement({
        bundleId: bundle.id,
        productId: "",
        type: "adjust",
        qtyDelta: delta,
        unit: bundle.unit,
        employeeId: user.id,
        deviceId,
        deviceTime: new Date().toISOString(),
        note: note || "Manual adjustment",
      });

      try {
        await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientUuid,
            bundleId: bundle.id,
            productId: bundle.id,
            type: "adjust",
            qtyDelta: delta,
            unit: bundle.unit,
            employeeId: user.id,
            deviceId,
            deviceTime: new Date().toISOString(),
            note: note || "Manual adjustment",
          }),
        });
      } catch {}

      setSuccessMsg(`✅ Adjusted by ${delta > 0 ? "+" : ""}${delta} ${bundle.unit}(s)`);
      setFlowState("success");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-orange-500 text-3xl animate-pulse">🔥</div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">❓</div>
        <p className="text-slate-400">Bundle not found</p>
        <button onClick={onBack} className="mt-4 text-orange-400 underline">Back</button>
      </div>
    );
  }

  const isRetired = bundle.status === "retired";

  if (flowState === "success") {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <p className="text-white font-semibold text-xl mb-2">{successMsg}</p>
        <p className="text-slate-400 text-sm mb-8">
          {bundle.code} — {bundle.qtyRemaining} {bundle.unit}(s) remaining
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setFlowState("detail")}
            className="bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl transition-colors"
          >
            View Bundle
          </button>
          <button
            onClick={onBack}
            className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            Scan Another
          </button>
        </div>
      </div>
    );
  }

  if (flowState === "pull") {
    return (
      <div>
        <button onClick={() => { setFlowState("detail"); setError(""); }} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          ← Back to bundle
        </button>
        <h2 className="text-xl font-bold text-white mb-1">Pull from Bundle</h2>
        <p className="text-slate-400 text-sm mb-6">{bundle.code} · {bundle.productName}</p>

        <div className="space-y-4">
          {/* Job selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Job *</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">— Select a job —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} · {j.customerName}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Quantity ({bundle.unit}s) — {bundle.qtyRemaining} available
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-xl flex items-center justify-center transition-colors"
              >
                −
              </button>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={Number(bundle.qtyRemaining)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-bold focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={() => setQty(Math.min(Number(bundle.qtyRemaining), qty + 1))}
                className="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-xl flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any notes…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handlePull}
            disabled={submitting}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors"
          >
            {submitting ? "Recording…" : `Confirm Pull — ${qty} ${bundle.unit}(s)`}
          </button>
        </div>
      </div>
    );
  }

  if (flowState === "return") {
    return (
      <div>
        <button onClick={() => { setFlowState("detail"); setError(""); }} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          ← Back to bundle
        </button>
        <h2 className="text-xl font-bold text-white mb-1">Return to Bundle</h2>
        <p className="text-slate-400 text-sm mb-6">{bundle.code} · {bundle.productName}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Quantity ({bundle.unit}s)
            </label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-xl flex items-center justify-center">−</button>
              <input type="number" value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} min={1} className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-bold focus:outline-none focus:border-orange-500" />
              <button onClick={() => setQty(qty + 1)} className="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-xl flex items-center justify-center">+</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Reason</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are these being returned?" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500" />
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

          <button onClick={handleReturn} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors">
            {submitting ? "Recording…" : `Confirm Return — ${qty} ${bundle.unit}(s)`}
          </button>
        </div>
      </div>
    );
  }

  if (flowState === "adjust") {
    return (
      <div>
        <button onClick={() => { setFlowState("detail"); setError(""); }} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          ← Back to bundle
        </button>
        <h2 className="text-xl font-bold text-white mb-1">Adjust Bundle</h2>
        <p className="text-slate-400 text-sm mb-6">{bundle.code} · {bundle.productName} · {bundle.qtyRemaining} remaining</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Adjustment (signed — e.g. -5 or +3)</label>
            <input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-bold focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Reason *</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment…" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500" />
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

          <button onClick={handleAdjust} disabled={submitting} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors">
            {submitting ? "Recording…" : "Confirm Adjustment"}
          </button>
        </div>
      </div>
    );
  }

  // Detail view
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
        ← Back
      </button>

      {/* Bundle header */}
      <div className={`rounded-2xl p-5 mb-4 ${isRetired ? "bg-slate-800 border border-slate-700" : "bg-slate-900 border border-slate-800"}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-slate-500 font-mono mb-1">{bundle.code}</div>
            <h2 className="text-xl font-bold text-white">{bundle.productName}</h2>
            <div className="text-sm text-slate-400">{bundle.productSku} · {bundle.productCategory}</div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            isRetired ? "bg-slate-700 text-slate-400" : "bg-green-500/20 text-green-400"
          }`}>
            {isRetired ? "Retired" : "Active"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-950/50 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${isRetired ? "text-slate-500" : "text-white"}`}>
              {bundle.qtyRemaining}
            </div>
            <div className="text-xs text-slate-500">Remaining</div>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-slate-400">{bundle.qtyReceived}</div>
            <div className="text-xs text-slate-500">Received</div>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3 text-center">
            <div className="text-sm font-bold text-slate-400 pt-2">{bundle.unit}</div>
            <div className="text-xs text-slate-500">Unit</div>
          </div>
        </div>

        {bundle.location && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <span>📍</span> {bundle.location}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isRetired ? (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => { setFlowState("pull"); setQty(1); setNote(""); setError(""); setSelectedJobId(""); }}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl flex flex-col items-center gap-1 transition-colors"
          >
            <span className="text-xl">↓</span>
            <span className="text-sm">Pull</span>
          </button>
          <button
            onClick={() => { setFlowState("return"); setQty(1); setNote(""); setError(""); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl flex flex-col items-center gap-1 transition-colors"
          >
            <span className="text-xl">↑</span>
            <span className="text-sm">Return</span>
          </button>
          {user.role === "admin" && (
            <button
              onClick={() => { setFlowState("adjust"); setQty(0); setNote(""); setError(""); }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 rounded-xl flex flex-col items-center gap-1 transition-colors"
            >
              <span className="text-xl">±</span>
              <span className="text-sm">Adjust</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 text-sm text-center mb-6">
          This bundle is retired — no further movements allowed. History is preserved below.
        </div>
      )}

      {/* Movement history */}
      {movements.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">History</h3>
          </div>
          <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.type === "pull" ? "bg-red-500/20 text-red-400" :
                      m.type === "receive" ? "bg-green-500/20 text-green-400" :
                      m.type === "return" ? "bg-blue-500/20 text-blue-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>{m.type}</span>
                    <span className={`text-sm font-semibold ${Number(m.qtyDelta) < 0 ? "text-red-400" : "text-green-400"}`}>
                      {Number(m.qtyDelta) > 0 ? "+" : ""}{m.qtyDelta} {m.unit}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(m.serverTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {m.employeeName}
                  {m.jobCode && ` · ${m.jobCode} (${m.jobCustomerName})`}
                  {m.note && ` · ${m.note}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
