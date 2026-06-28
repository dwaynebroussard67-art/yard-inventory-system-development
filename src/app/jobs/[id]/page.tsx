"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { NavBar } from "@/components/NavBar";

interface PackingItem {
  movementId: string;
  type: string;
  qtyDelta: string;
  unit: string;
  deviceTime: string;
  serverTime: string;
  note: string | null;
  bundleId: string | null;
  bundleCode: string | null;
  productName: string | null;
  productSku: string | null;
  employeeName: string | null;
}

interface Job {
  id: string;
  code: string;
  customerName: string;
  customerRef: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
}

export default function JobDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [packingList, setPackingList] = useState<PackingItem[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !id) return;
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setJob(d.job || null);
        setPackingList(d.packingList || []);
        setFetching(false);
      });
  }, [user, id]);

  const handlePrint = () => window.print();

  if (loading || !user || fetching) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-orange-500 text-4xl animate-pulse">🔥</div></div>;
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-950">
        <NavBar />
        <div className="text-center py-20 text-slate-400">Job not found</div>
      </div>
    );
  }

  // Summarize by product
  const summary = packingList.reduce<Record<string, { productName: string | null; productSku: string | null; qty: number; unit: string }>>((acc, item) => {
    const key = item.productSku || item.productName || "unknown";
    if (!acc[key]) {
      acc[key] = { productName: item.productName, productSku: item.productSku, qty: 0, unit: item.unit };
    }
    acc[key].qty += Math.abs(Number(item.qtyDelta));
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/jobs" className="text-slate-400 hover:text-white transition-colors">←</Link>
          <div className="flex-1">
            <div className="font-mono text-sm text-orange-400">{job.code}</div>
            <h1 className="text-xl font-bold text-white">{job.customerName}</h1>
          </div>
          <div className="flex gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              job.status === "open" ? "bg-green-500/20 text-green-400" :
              job.status === "loading" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-slate-700 text-slate-400"
            }`}>{job.status}</span>
            <button onClick={handlePrint} className="no-print bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
              🖨️ Print
            </button>
          </div>
        </div>

        {/* Job info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {job.customerRef && <div><span className="text-slate-400">Customer PO:</span> <span className="text-white">{job.customerRef}</span></div>}
            <div><span className="text-slate-400">Created:</span> <span className="text-white">{new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
            {job.closedAt && <div><span className="text-slate-400">Closed:</span> <span className="text-white">{new Date(job.closedAt).toLocaleDateString()}</span></div>}
            {job.notes && <div className="col-span-2"><span className="text-slate-400">Notes:</span> <span className="text-white">{job.notes}</span></div>}
          </div>
        </div>

        {packingList.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No pulls recorded yet for this job</div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800">
                <h2 className="font-semibold text-white">Packing Summary</h2>
              </div>
              <div className="divide-y divide-slate-800">
                {Object.entries(summary).map(([key, s]) => (
                  <div key={key} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{s.productName}</div>
                      <div className="text-xs text-slate-400">{s.productSku}</div>
                    </div>
                    <div className="text-sm font-bold text-orange-400">
                      {s.qty.toLocaleString()} {s.unit}s
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 flex items-center justify-between bg-slate-800/50">
                  <div className="text-sm font-bold text-white">Total pieces</div>
                  <div className="text-sm font-bold text-orange-400">
                    {Object.values(summary).reduce((s, v) => s + v.qty, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed packing list */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <h2 className="font-semibold text-white">Detailed Pull Log</h2>
              </div>
              <div className="divide-y divide-slate-800">
                {packingList.map((item) => (
                  <div key={item.movementId} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{item.productName}</div>
                        <div className="text-xs text-slate-400">
                          {item.bundleCode} · {item.employeeName}
                        </div>
                        {item.note && <div className="text-xs text-slate-500 mt-0.5">{item.note}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-400">
                          {Math.abs(Number(item.qtyDelta))} {item.unit}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(item.serverTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
