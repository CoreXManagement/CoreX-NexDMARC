"use client";
import { useEffect, useState } from "react";

export function UpdateBanner() {
  const [info, setInfo] = useState<{ current: string; latest: string } | null>(null);
  useEffect(() => {
    fetch("/api/update/check").then((r) => r.json()).then((d) => {
      if (d?.update_available) setInfo({ current: d.current, latest: d.latest });
    }).catch(() => {});
  }, []);
  if (!info) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-cyan-800/40 bg-cyan-950/30 px-4 py-2 text-xs text-cyan-200">
      <span>Update verfügbar: {info.current} → {info.latest}</span>
      <a href="/settings" className="underline">Jetzt updaten →</a>
    </div>
  );
}
