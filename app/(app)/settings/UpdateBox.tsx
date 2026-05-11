"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CheckResult = { current: string; latest: string | null; update_available: boolean };

export function UpdateBox() {
  const [info, setInfo] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/update/check").then((r) => r.json()).then(setInfo).catch(() => {});
  }, []);
  async function apply() {
    setBusy(true);
    setLog(null);
    const res = await fetch("/api/update/apply", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setLog(data?.log ?? data?.error ?? "OK");
  }
  return (
    <Card>
      <CardHeader><CardTitle>Update</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p>Installierte Version: <span className="font-mono text-zinc-300">{info?.current ?? "..."}</span></p>
        <p>Letzte Release-Version: <span className="font-mono text-zinc-300">{info?.latest ?? "..."}</span></p>
        {info?.update_available ? (
          <Button onClick={apply} disabled={busy}>{busy ? "Updating..." : "Update installieren"}</Button>
        ) : <p className="text-zinc-500">Aktuell — kein Update.</p>}
        {log ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[10px] text-zinc-400">{log}</pre> : null}
      </CardContent>
    </Card>
  );
}
