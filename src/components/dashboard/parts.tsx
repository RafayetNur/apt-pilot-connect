import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  to,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  to?: string;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-primary"
      : tone === "warning"
        ? "text-[color:var(--warning,inherit)]"
        : tone === "danger"
          ? "text-destructive"
          : "";

  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-semibold", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted"
      >
        {body}
      </Link>
    );
  }

  return <div className="rounded-2xl border border-border/60 bg-card p-4">{body}</div>;
}

export function DashboardSection({
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
    <section className="panel mt-6 p-4 sm:p-6">
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

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function QuickActions({ items }: { items: Array<{ label: string; to: string }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={`${item.label}-${item.to}`}
          to={item.to}
          className="rounded-xl border border-border/60 bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Month</span>
      <input
        type="month"
        value={month}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
      />
    </label>
  );
}
