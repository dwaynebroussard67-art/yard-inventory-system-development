"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NavBar } from "@/components/NavBar";
import { BundleDetail } from "@/components/BundleDetail";

export default function BundlePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=/bundle/${id}`);
    }
  }, [user, loading, router, id]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-orange-500 text-4xl animate-pulse">🔥</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        <BundleDetail
          bundleId={id}
          user={user}
          onBack={() => router.push("/scan")}
        />
      </main>
    </div>
  );
}
