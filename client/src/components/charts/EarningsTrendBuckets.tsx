// client/src/components/charts/EarningsTrendBuckets.tsx
import { useState } from "react";
import { useEarningsBuckets } from "@/hooks/useEarningsBuckets";
import type { BucketMode } from "@/lib/timeBuckets";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function EarningsTrendBuckets({ tutorId }: { tutorId?: string }) {
  const [mode, setMode] = useState<BucketMode>("month"); // default Month
  const { data = [], isLoading, isError } = useEarningsBuckets(mode, tutorId);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Earnings Trend ({mode === "week" ? "Weekly" : "Monthly"})</div>
        <div className="inline-flex rounded-md border">
          <button
            className={cn("px-2 py-1 text-sm", mode === "week" ? "bg-primary text-primary-foreground" : "bg-background")}
            onClick={() => setMode("week")}
            aria-pressed={mode === "week"}
            aria-label="Show weekly totals"
            data-testid="button-week-toggle"
          >
            Week
          </button>
          <button
            className={cn("px-2 py-1 text-sm border-l", mode === "month" ? "bg-primary text-primary-foreground" : "bg-background")}
            onClick={() => setMode("month")}
            aria-pressed={mode === "month"}
            aria-label="Show monthly totals"
            data-testid="button-month-toggle"
          >
            Month
          </button>
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const b = payload[0]?.payload as any;
                const hours = b?.hours ?? 0;
                const earnings = b?.earnings ?? 0;
                const sessions = b?.sessions ?? 0;
                const avg = hours > 0 ? (earnings / hours) : 0;
                return (
                  <div className="rounded border bg-popover px-3 py-2 text-sm shadow">
                    <div className="font-medium">{label}</div>
                    <div>Earnings: <strong>{earnings}</strong></div>
                    <div>Hours: <strong>{hours}</strong></div>
                    <div>Sessions: <strong>{sessions}</strong></div>
                    <div>Avg hourly: <strong>{avg.toFixed(2)}</strong></div>
                    {b?.partial ? <div className="mt-1 text-xs text-muted-foreground">(current period, partial)</div> : null}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="earnings"
              radius={[6, 6, 0, 0]}
              // lighter bar for current (partial) period:
              fillOpacity={1}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                const partial = payload?.partial;
                return (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx={6}
                      ry={6}
                      className={partial ? "fill-primary/60" : "fill-primary"}
                    />
                  </g>
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {(isLoading || isError) && (
        <div className="mt-2 text-xs text-muted-foreground" data-testid="status-message">
          {isLoading ? "Loading…" : "Could not load data."}
        </div>
      )}
    </Card>
  );
}