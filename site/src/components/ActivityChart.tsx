"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ActivityPoint } from "@/lib/server-activity";

export function ActivityChart({
  data,
  viewsLabel,
  launchesLabel,
}: {
  data: ActivityPoint[];
  viewsLabel: string;
  launchesLabel: string;
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} />
          <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Legend />
          <Line type="monotone" dataKey="views" name={viewsLabel} stroke="var(--accent)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="launches" name={launchesLabel} stroke="var(--accent-2)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
