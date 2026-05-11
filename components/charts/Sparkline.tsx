"use client";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";

export function Sparkline({ data, height = 40 }: { data: { t: number; v: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sl-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip contentStyle={{ background: "#0a0c10", border: "1px solid #27272a", fontSize: 11 }} labelFormatter={() => ""} />
        <Area type="monotone" dataKey="v" stroke="#22d3ee" strokeWidth={1.5} fill="url(#sl-grad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
