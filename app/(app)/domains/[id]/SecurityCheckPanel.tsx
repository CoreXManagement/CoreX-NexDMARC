"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Item = { key: string; title: string; severity: "ok" | "warn" | "fail" | "info"; summary: string; detail?: string; fix?: string };
type Result = { domain: string; ts: number; grade: string; score: number; items: Item[] };

export function SecurityCheckPanel({ domain, initial }: { domain: string; initial: Result | null }) {
  const [data, setData] = useState<Result | null>(initial);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await fetch(`/api/security/check?domain=${encodeURIComponent(domain)}`, { method: "POST" });
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Mail-Security-Check</CardTitle>
        <div className="flex items-center gap-2">
          {data ? <Badge variant={data.grade === "A" ? "ok" : data.grade === "F" ? "fail" : "warn"}>Grade {data.grade} · {data.score}/100</Badge> : null}
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>{loading ? "..." : "Jetzt prüfen"}</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data && <p className="text-xs text-zinc-500">Noch keine Prüfung. Klick "Jetzt prüfen".</p>}
        {data?.items.map((it) => (
          <details key={it.key} className="group rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3 open:bg-zinc-900/40">
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2">
                <Badge variant={it.severity}>{it.severity}</Badge>
                <span className="font-semibold text-zinc-200">{it.title}</span>
              </span>
              <span className="hidden truncate text-zinc-500 group-open:hidden md:inline">{it.summary}</span>
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              <p className="text-zinc-300">{it.summary}</p>
              {it.detail ? <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[11px] text-zinc-400">{it.detail}</pre> : null}
              {it.fix ? (
                <div className="rounded border border-cyan-900/40 bg-cyan-950/20 p-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-cyan-400">Fix</p>
                  <pre className="whitespace-pre-wrap text-[11px] text-cyan-200">{it.fix}</pre>
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
