import type { ReactNode } from "react";

import { formatRent } from "@/lib/flats";
import { cn } from "@/lib/utils";

export function ReportPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ReportEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function ReportError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Could not load this report.";
  return (
    <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      {message}
    </p>
  );
}

export function ReportLoading({ label = "Loading report…" }: { label?: string }) {
  return (
    <p className="rounded-xl border border-border/60 bg-surface p-4 text-sm text-muted-foreground">
      {label}
    </p>
  );
}

/**
 * Simple proportional bar list. Values come straight from the same query that
 * feeds the tables, so chart and table totals always match.
 */
export function BarList({
  items,
  emptyLabel = "Nothing to chart yet.",
  format = formatRent,
}: {
  items: Array<{ label: string; value: number }>;
  emptyLabel?: string;
  format?: (value: number) => string;
}) {
  const max = items.reduce((acc, item) => Math.max(acc, item.value), 0);
  if (items.length === 0 || max <= 0) return <ReportEmpty>{emptyLabel}</ReportEmpty>;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="font-medium tabular-nums">{format(item.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TrendBars({
  items,
}: {
  items: Array<{ period: string; received: number; expenses: number }>;
}) {
  const max = items.reduce((acc, item) => Math.max(acc, item.received, item.expenses), 0);
  if (items.length === 0 || max <= 0) return <ReportEmpty>No movement in this period.</ReportEmpty>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full bg-primary/70" /> Cash received
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full bg-secondary-foreground/40" /> Approved expenses
        </span>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.period} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{item.period}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatRent(item.received)} / {formatRent(item.expenses)}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max((item.received / max) * 100, item.received > 0 ? 2 : 0)}%` }}
                />
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-secondary-foreground/40"
                  style={{
                    width: `${Math.max((item.expenses / max) * 100, item.expenses > 0 ? 2 : 0)}%`,
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportTable({
  headers,
  children,
  minWidth = "min-w-[900px]",
}: {
  headers: string[];
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", minWidth)}>
        <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-3 whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
