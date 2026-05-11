"use client";
export function HorizontalBar({ rows, height = "auto" }: { rows: { label: string; value: number; sub?: string }[]; height?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5" style={{ height }}>
      {rows.map((r, i) => {
        const pct = (r.value / max) * 100;
        return (
          <div key={i} className="grid grid-cols-[1fr,auto] items-center gap-3 text-xs">
            <div className="min-w-0">
              <div className="truncate text-zinc-300">{r.label}</div>
              {r.sub ? <div className="truncate text-[10px] text-zinc-500">{r.sub}</div> : null}
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/70">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="font-mono text-zinc-100 tabular-nums">{r.value.toLocaleString("de-DE")}</div>
          </div>
        );
      })}
    </div>
  );
}
