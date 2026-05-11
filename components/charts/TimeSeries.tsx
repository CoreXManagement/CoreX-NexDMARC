"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export function TimeSeries({
  data,
  series,
  height = 220,
}: {
  data: Array<Record<string, number | string>>;
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="day" stroke="#52525b" fontSize={11} />
        <YAxis stroke="#52525b" fontSize={11} />
        <Tooltip contentStyle={{ background: "#0a0c10", border: "1px solid #27272a", fontSize: 11 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} dot={false} strokeWidth={1.8} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
