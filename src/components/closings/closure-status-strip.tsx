import { useQuery } from "@tanstack/react-query";

import { MonthStatusBadge } from "@/components/closings/month-closing-section";
import { closuresQueryOptions, type MonthClosureStatus } from "@/lib/closings";
import { monthToDate } from "@/lib/rent";

/** Per-building closing status for one month — read-only, used on dashboards. */
export function ClosureStatusStrip({
  month,
  buildings,
}: {
  month: string;
  buildings: Array<{ id: string; name: string }>;
}) {
  const { data, isLoading } = useQuery(closuresQueryOptions());
  const billingMonth = monthToDate(month);

  if (buildings.length === 0) return null;

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {buildings.map((building) => {
        const closure = (data ?? []).find(
          (row) => row.building_id === building.id && row.billing_month === billingMonth,
        );
        const status: MonthClosureStatus = closure?.status ?? "open";
        return (
          <li
            key={building.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
          >
            <span className="font-medium">{building.name}</span>
            {isLoading ? (
              <span className="text-xs text-muted-foreground">Checking…</span>
            ) : (
              <MonthStatusBadge status={status} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
