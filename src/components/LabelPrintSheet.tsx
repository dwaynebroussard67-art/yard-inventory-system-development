"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface BundleLabel {
  id: string;
  code: string;
  productId: string;
  productName: string | null;
  qtyReceived: number;
  unit: string;
}

interface Props {
  bundles: BundleLabel[];
}

function QRLabel({ bundle, baseUrl }: { bundle: BundleLabel; baseUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const url = `${baseUrl}/bundle/${bundle.id}`;
    QRCode.toCanvas(canvasRef.current, url, {
      errorCorrectionLevel: "H",
      width: 160,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }, [bundle, baseUrl]);

  return (
    <div
      className="print-label border-2 border-gray-800 rounded-lg p-3 bg-white text-black flex flex-col items-center gap-2"
      style={{ width: "3.5in", height: "2in", pageBreakInside: "avoid" }}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-gray-300 pb-1.5 mb-1">
        <div className="text-xs font-bold text-orange-600 flex items-center gap-1">
          🔥 FORGE LOAD
        </div>
        <div className="text-xs font-mono text-gray-500">{bundle.code}</div>
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 w-full flex-1">
        <canvas ref={canvasRef} style={{ width: "120px", height: "120px" }} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-tight mb-1 text-gray-900 line-clamp-2">
            {bundle.productName}
          </div>
          <div className="text-xs text-gray-600 mb-1">
            <span className="font-semibold">Qty:</span> {bundle.qtyReceived} {bundle.unit}s
          </div>
          <div className="text-xs text-gray-400 font-mono break-all">{bundle.id.slice(0, 12)}…</div>
          <div className="mt-2 text-xs text-gray-500">Location: ___________</div>
        </div>
      </div>
    </div>
  );
}

export function LabelPrintSheet({ bundles }: Props) {
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Print controls — hidden during print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div className="text-slate-300 text-sm">
          {bundles.length} label{bundles.length !== 1 ? "s" : ""} generated
        </div>
        <div className="flex gap-3">
          <div className="text-xs text-slate-500 flex items-center">
            EC Level H · UV/weatherproof film recommended
          </div>
          <button
            onClick={handlePrint}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
          >
            🖨️ Print Labels
          </button>
        </div>
      </div>

      {/* Label sheet */}
      <div
        className="bg-white p-4"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 3.5in)", gap: "0.25in" }}
      >
        {baseUrl &&
          bundles.map((bundle) => (
            <QRLabel key={bundle.id} bundle={bundle} baseUrl={baseUrl} />
          ))}
      </div>
    </div>
  );
}
