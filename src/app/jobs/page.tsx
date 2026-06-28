"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { NavBar } from "@/components/NavBar";

interface Job {
  id: string;
  code: string;
  customerName: string;
  customerRef: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  customerId: string | null;
}

interface Customer {
  id: string;
  name: string;
  ref: string | null;
}

export default function JobsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showNewJob, setShowNewJob] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"open" | "loading" | "closed" | "all">("open");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchJobs = () => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs || []); setFetching(false); });
  };

  useEffect(() => {
    if (!user) return;
    fetchJobs();
    if (user.role === "admin") {
      fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || []));
    }
  }, [user]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { setError("Please select a customer"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, customerRef, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }
      setShowNewJob(false);
      setCustomerId(""); setCustomerRef(""); setNotes("");
      fetchJobs();
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (jobId: string, status: string) => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchJobs();
  };

  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  if (loading || !user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-orange-500 text-4xl animate-pulse">🔥</div></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          {user.role === "admin" && (
            <button
              onClick={() => setShowNewJob(!showNewJob)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              + New Job
            </button>
          )}
        </div>

        {/* New job form */}
        {showNewJob && user.role === "admin" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
            <h3 className="font-semibold text-white mb-4">Create Job</h3>
            <form onSubmit={handleCreateJob} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
                  required
                >
                  <option value="">— Select customer —</option>
                  {customers.filter((c) => c).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.ref ? ` (${c.ref})` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Customer PO Ref</label>
                  <input type="text" value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} placeholder="PO-12345" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notes</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-sm">{error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNewJob(false)} className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">
                  {submitting ? "Creating…" : "Create Job"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(["open", "loading", "closed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Job list */}
        {fetching ? (
          <div className="text-center py-12 text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No {filter === "all" ? "" : filter} jobs</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <Link href={`/jobs/${job.id}`} className="block p-4 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-orange-400">{job.code}</div>
                      <div className="font-semibold text-white">{job.customerName}</div>
                      {job.customerRef && <div className="text-xs text-slate-400">Ref: {job.customerRef}</div>}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      job.status === "open" ? "bg-green-500/20 text-green-400" :
                      job.status === "loading" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-slate-700 text-slate-400"
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  {job.notes && <div className="text-xs text-slate-400 mb-2">{job.notes}</div>}
                  <div className="text-xs text-slate-500">
                    {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {job.closedAt && ` · Closed ${new Date(job.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </div>
                </Link>
                {user.role === "admin" && job.status !== "closed" && (
                  <div className="px-4 pb-3 flex gap-2">
                    {job.status === "open" && (
                      <button onClick={() => handleStatusChange(job.id, "loading")} className="text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 px-3 py-1.5 rounded-lg transition-colors">
                        Mark Loading
                      </button>
                    )}
                    <button onClick={() => handleStatusChange(job.id, "closed")} className="text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors">
                      Close Job
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
