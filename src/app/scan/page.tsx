"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NavBar } from "@/components/NavBar";
import { BundleDetail } from "@/components/BundleDetail";

type ScanState = "idle" | "scanning" | "found" | "not_found";

export default function ScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [manualCode, setManualCode] = useState("");
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    scanningRef.current = false;
  }, []);

  const lookupBundle = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/bundles/${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        setBundleId(data.bundle.id);
        setScanState("found");
        stopCamera();
      } else {
        setError(`Bundle "${code}" not found`);
        setScanState("not_found");
        stopCamera();
      }
    } catch {
      setError("Error looking up bundle. Check your connection.");
      setScanState("not_found");
      stopCamera();
    }
  }, [stopCamera]);

  const startScanner = useCallback(async () => {
    setScanState("scanning");
    setError("");
    setBundleId(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Use BarcodeDetector if available
      if ("BarcodeDetector" in window) {
        const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ["qr_code"] });
        scanningRef.current = true;

        const scan = async () => {
          if (!scanningRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const value = codes[0].rawValue;
              scanningRef.current = false;
              // Extract bundle ID from URL if it's a URL
              const match = value.match(/\/bundle\/([^/?]+)/);
              const code = match ? match[1] : value;
              await lookupBundle(code);
              return;
            }
          } catch {}
          if (scanningRef.current) requestAnimationFrame(scan);
        };

        videoRef.current?.addEventListener("loadedmetadata", () => {
          requestAnimationFrame(scan);
        });
      }
    } catch (err) {
      setError("Camera access denied. Use manual entry below.");
      setScanState("idle");
    }
  }, [lookupBundle]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleManualLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setScanState("scanning");
    await lookupBundle(manualCode.trim().toUpperCase());
  };

  const reset = () => {
    setScanState("idle");
    setBundleId(null);
    setError("");
    setManualCode("");
    stopCamera();
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-orange-500 text-4xl animate-pulse">🔥</div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {scanState === "found" && bundleId ? (
          <BundleDetail bundleId={bundleId} user={user} onBack={reset} />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-6">Scan Bundle</h1>

            {/* Camera view */}
            {scanState === "scanning" && (
              <div className="relative bg-black rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: "4/3" }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                {/* Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-orange-500 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-xl" />
                    {/* Scan line animation */}
                    <div className="absolute inset-x-0 h-0.5 bg-orange-500 opacity-80 animate-bounce" style={{ top: "50%" }} />
                  </div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
                  Point camera at QR code
                </div>
              </div>
            )}

            {/* Idle state */}
            {scanState === "idle" && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center mb-4">
                <div className="text-6xl mb-4">📷</div>
                <h2 className="text-white font-semibold text-lg mb-2">Ready to Scan</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Point your camera at a bundle QR code, or enter the code manually
                </p>
                <button
                  onClick={startScanner}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-colors"
                >
                  Start Camera
                </button>
              </div>
            )}

            {scanState === "scanning" && (
              <button
                onClick={reset}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl mb-4 transition-colors"
              >
                Cancel
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            {/* Manual entry */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Manual Entry</h3>
              <form onSubmit={handleManualLookup} className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="BND-2026-000001 or UUID"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500"
                />
                <button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Go
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
