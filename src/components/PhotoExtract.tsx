"use client";

import { useState, useRef } from "react";

interface Product {
  id: string;
  sku: string;
  name: string;
  baseUnit: string;
}

interface ExtractedRow {
  description: string;
  qty_per_bundle: number | null;
  bundle_count: number | null;
  unit: string | null;
}

interface ReceiptLine {
  productId: string;
  qtyPerBundle: number;
  bundleCount: number;
  unit: string;
}

interface ReviewRow extends ExtractedRow {
  matchedProductId: string;
  qtyPerBundle: number;
  bundleCount: number;
  unit: string;
}

interface Props {
  products: Product[];
  onConfirm: (lines: ReceiptLine[]) => void;
  onCancel: () => void;
}

export function PhotoExtract({ products, onConfirm, onCancel }: Props) {
  const [stage, setStage] = useState<"upload" | "extracting" | "review" | "error">("upload");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fuzzyMatch = (description: string): string => {
    const desc = description.toLowerCase();
    const match = products.find(
      (p) =>
        p.name.toLowerCase().includes(desc) ||
        desc.includes(p.name.toLowerCase()) ||
        p.sku.toLowerCase().includes(desc) ||
        desc.includes(p.sku.toLowerCase())
    );
    return match?.id || "";
  };

  const handleFile = async (file: File) => {
    setStage("extracting");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const [header, data] = dataUrl.split(",");
      const mediaType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";

      try {
        const res = await fetch("/api/extract-inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: data, media_type: mediaType }),
        });

        if (!res.ok) {
          const err = await res.json();
          setErrorMsg(err.error || "Extraction failed");
          setStage("error");
          return;
        }

        const { rows: extractedRows } = await res.json();
        const reviewRows: ReviewRow[] = (extractedRows as ExtractedRow[]).map((r) => ({
          ...r,
          matchedProductId: fuzzyMatch(r.description),
          qtyPerBundle: r.qty_per_bundle ?? 1,
          bundleCount: r.bundle_count ?? 1,
          unit: r.unit ?? "piece",
        }));
        setRows(reviewRows);
        setStage("review");
      } catch {
        setErrorMsg("Network error during extraction");
        setStage("error");
      }
    };
    reader.readAsDataURL(file);
  };

  const updateRow = (i: number, field: keyof ReviewRow, value: string | number) => {
    const newRows = [...rows];
    newRows[i] = { ...newRows[i], [field]: value };
    setRows(newRows);
  };

  const handleConfirm = () => {
    const lines: ReceiptLine[] = rows
      .filter((r) => r.matchedProductId)
      .map((r) => ({
        productId: r.matchedProductId,
        qtyPerBundle: Number(r.qtyPerBundle) || 1,
        bundleCount: Number(r.bundleCount) || 1,
        unit: r.unit || "piece",
      }));
    onConfirm(lines);
  };

  if (stage === "upload") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">📸 Photo to Inventory (AI)</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm">Cancel</button>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Take a photo of an order sheet or handwritten list. Claude will extract the line items for you to review.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors"
        >
          <span className="text-2xl">📷</span>
          Take Photo / Upload Image
        </button>
        <p className="text-xs text-slate-600 mt-3 text-center">
          Nothing is added to inventory until you review and confirm
        </p>
      </div>
    );
  }

  if (stage === "extracting") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
        <div className="text-4xl mb-4 animate-pulse">🤖</div>
        <h3 className="font-semibold text-white mb-2">Extracting line items…</h3>
        <p className="text-slate-400 text-sm">Claude is reading your photo</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-4">❌</div>
        <h3 className="font-semibold text-white mb-2">Extraction failed</h3>
        <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
        <button onClick={() => setStage("upload")} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl">Try Again</button>
        <button onClick={onCancel} className="ml-3 text-slate-400 hover:text-white text-sm">Cancel</button>
      </div>
    );
  }

  // Review stage
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Review Extracted Lines</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm">Cancel</button>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        Review and correct the extracted rows. Rows without a matched product will be skipped.
      </p>

      <div className="space-y-3 mb-6">
        {rows.map((row, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 mb-2 font-mono">"{row.description}"</div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Product *</label>
                <select
                  value={row.matchedProductId}
                  onChange={(e) => updateRow(i, "matchedProductId", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                >
                  <option value="">— Not matched, skip —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Qty/Bundle</label>
                  <input
                    type="number"
                    min={1}
                    value={row.qtyPerBundle ?? ""}
                    onChange={(e) => updateRow(i, "qtyPerBundle", parseInt(e.target.value) || 1)}
                    placeholder="null"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1"># Bundles</label>
                  <input
                    type="number"
                    min={1}
                    value={row.bundleCount ?? ""}
                    onChange={(e) => updateRow(i, "bundleCount", parseInt(e.target.value) || 1)}
                    placeholder="null"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unit</label>
                  <select
                    value={row.unit || "piece"}
                    onChange={(e) => updateRow(i, "unit", e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="piece">piece</option>
                    <option value="linear_ft">linear_ft</option>
                    <option value="board_ft">board_ft</option>
                    <option value="bundle">bundle</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Use These Lines ({rows.filter((r) => r.matchedProductId).length} matched)
        </button>
      </div>
    </div>
  );
}
