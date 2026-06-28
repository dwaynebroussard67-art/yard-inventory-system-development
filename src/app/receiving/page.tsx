"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NavBar } from "@/components/NavBar";
import { LabelPrintSheet } from "@/components/LabelPrintSheet";
import { PhotoExtract } from "@/components/PhotoExtract";

interface Product {
  id: string;
  sku: string;
  name: string;
  baseUnit: string;
  piecesPerBundle: string | null;
}

interface Receipt {
  id: string;
  code: string;
  supplier: string | null;
  poNumber: string | null;
  createdAt: string;
  status: string;
}

interface ReceiptLine {
  productId: string;
  qtyPerBundle: number;
  bundleCount: number;
  unit: string;
}

interface GeneratedBundle {
  id: string;
  code: string;
  productId: string;
  productName: string | null;
  qtyReceived: number;
  unit: string;
}

export default function ReceivingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [tab, setTab] = useState<"new" | "history">("new");

  // New receipt form
  const [supplier, setSupplier] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>([{ productId: "", qtyPerBundle: 1, bundleCount: 1, unit: "piece" }]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [generatedBundles, setGeneratedBundles] = useState<GeneratedBundle[]>([]);
  const [showLabels, setShowLabels] = useState(false);
  const [showPhotoExtract, setShowPhotoExtract] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role !== "admin") router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products || []));
    fetch("/api/receipts").then((r) => r.json()).then((d) => setReceipts(d.receipts || []));
  }, [user]);

  const addLine = () => {
    setLines([...lines, { productId: "", qtyPerBundle: 1, bundleCount: 1, unit: "piece" }]);
  };

  const removeLine = (i: number) => {
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, field: keyof ReceiptLine, value: string | number) => {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], [field]: value };
    // Auto-fill unit from product
    if (field === "productId") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newLines[i].unit = product.baseUnit;
        if (product.piecesPerBundle) {
          newLines[i].qtyPerBundle = Number(product.piecesPerBundle);
        }
      }
    }
    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.some((l) => !l.productId)) {
      setError("Please select a product for each line");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier, poNumber, notes, lines }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create receipt");
        return;
      }
      setGeneratedBundles(data.bundles || []);
      setShowLabels(true);
      // Refresh receipts
      fetch("/api/receipts").then((r) => r.json()).then((d) => setReceipts(d.receipts || []));
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoLines = (extractedLines: ReceiptLine[]) => {
    setLines(extractedLines);
    setShowPhotoExtract(false);
  };

  if (loading || !user || user.role !== "admin") {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-orange-500 text-4xl animate-pulse">🔥</div></div>;
  }

  if (showLabels) {
    return (
      <div className="min-h-screen bg-slate-950">
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6">
          <div className="no-print flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Print Labels</h1>
            <button
              onClick={() => {
                setShowLabels(false);
                setLines([{ productId: "", qtyPerBundle: 1, bundleCount: 1, unit: "piece" }]);
                setSupplier(""); setPoNumber(""); setNotes("");
              }}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm"
            >
              ← New Receipt
            </button>
          </div>
          <LabelPrintSheet bundles={generatedBundles} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        <h1 className="text-2xl font-bold text-white mb-6">Receiving</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(["new", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "new" ? "New Receipt" : "History"}
            </button>
          ))}
        </div>

        {tab === "new" && (
          <>
            {showPhotoExtract ? (
              <PhotoExtract
                products={products}
                onConfirm={handlePhotoLines}
                onCancel={() => setShowPhotoExtract(false)}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo import */}
                <button
                  type="button"
                  onClick={() => setShowPhotoExtract(true)}
                  className="w-full bg-slate-900 border border-dashed border-slate-600 hover:border-orange-500 text-slate-300 hover:text-orange-400 rounded-xl py-4 flex items-center justify-center gap-3 transition-colors"
                >
                  <span className="text-2xl">📸</span>
                  <div className="text-left">
                    <div className="font-medium text-sm">Import from Photo (AI)</div>
                    <div className="text-xs text-slate-500">Snap an order sheet to extract line items</div>
                  </div>
                </button>

                {/* Receipt info */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-white text-sm">Receipt Info</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Supplier</label>
                      <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">PO Number</label>
                      <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-XXXX" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Notes</label>
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                  </div>
                </div>

                {/* Lines */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Line Items</h3>
                    <button type="button" onClick={addLine} className="text-orange-400 hover:text-orange-300 text-sm font-medium">+ Add Line</button>
                  </div>

                  {lines.map((line, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Line {i + 1}</span>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Product *</label>
                        <select
                          value={line.productId}
                          onChange={(e) => updateLine(i, "productId", e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                          required
                        >
                          <option value="">— Select product —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Qty/Bundle</label>
                          <input type="number" min={1} value={line.qtyPerBundle} onChange={(e) => updateLine(i, "qtyPerBundle", parseInt(e.target.value) || 1)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1"># Bundles</label>
                          <input type="number" min={1} value={line.bundleCount} onChange={(e) => updateLine(i, "bundleCount", parseInt(e.target.value) || 1)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Unit</label>
                          <select value={line.unit} onChange={(e) => updateLine(i, "unit", e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                            <option value="piece">piece</option>
                            <option value="linear_ft">linear_ft</option>
                            <option value="board_ft">board_ft</option>
                            <option value="bundle">bundle</option>
                          </select>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        Total: {(line.qtyPerBundle * line.bundleCount).toLocaleString()} {line.unit}s across {line.bundleCount} bundle{line.bundleCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>

                {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors"
                >
                  {submitting ? "Creating receipt…" : "Create Receipt & Generate Labels"}
                </button>
              </form>
            )}
          </>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {receipts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No receipts yet</div>
            ) : (
              receipts.map((r) => (
                <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-sm font-bold text-orange-400">{r.code}</div>
                      <div className="text-sm text-white mt-0.5">{r.supplier || "No supplier"}</div>
                      {r.poNumber && <div className="text-xs text-slate-400">PO: {r.poNumber}</div>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
