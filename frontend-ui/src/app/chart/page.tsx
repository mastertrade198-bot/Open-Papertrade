"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
function ChartRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const symbol = params.get("symbol");
    router.replace(symbol ? `/trade?symbol=${encodeURIComponent(symbol)}` : "/trade");
  }, [router, params]);
  return <div className="p-6 text-sm">Abrindo terminal de negociação…</div>;
}
export default function ChartPage() { return <Suspense fallback={null}><ChartRedirect /></Suspense>; }
