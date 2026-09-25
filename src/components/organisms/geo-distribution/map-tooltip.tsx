"use client";

import { numberFormatter } from "@/lib/services/organisms/utils";

import type { HoverPayload } from "./choropleth-svg";

interface MapTooltipProps {
  data: HoverPayload;
}

const maxBreakdownItems = 3;

function topItems(record: Record<string, number>): [string, number][] {
  return Object.entries(record)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxBreakdownItems);
}

function percent(part: number, total: number): string {
  if (!total) return "0%";
  return `${String(Math.round((part / total) * 100))}%`;
}

export function MapTooltip({ data }: MapTooltipProps) {
  const total = data.count;
  const genera = topItems(data.genera);
  const hosts = topItems(data.hosts);

  return (
    <div className="w-max max-w-60 text-xs text-foreground">
      <div className="text-sm font-semibold">{data.name || "Unknown"}</div>
      <div className="text-muted-foreground tabular-nums">
        {total > 0
          ? `${numberFormatter.format(total)} ${total === 1 ? "genome" : "genomes"}`
          : "No data available"}
      </div>
      {genera.length > 0 && (
        <div className="mt-2 border-t border-border/40 pt-2">
          <div className="mb-1 text-3xs font-semibold tracking-wide text-muted-foreground uppercase">
            Top Genera
          </div>
          {genera.map(([name, value]) => (
            <div key={name} className="flex justify-between gap-2 tabular-nums">
              <span className="truncate italic">{name}</span>
              <span className="shrink-0 text-muted-foreground">
                {numberFormatter.format(value)} ({percent(value, total)})
              </span>
            </div>
          ))}
        </div>
      )}
      {hosts.length > 0 && (
        <div className="mt-2 border-t border-border/40 pt-2">
          <div className="mb-1 text-3xs font-semibold tracking-wide text-muted-foreground uppercase">
            Top Hosts
          </div>
          {hosts.map(([name, value]) => (
            <div key={name} className="flex justify-between gap-2 tabular-nums">
              <span className="truncate">{name}</span>
              <span className="shrink-0 text-muted-foreground">
                {numberFormatter.format(value)} ({percent(value, total)})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
