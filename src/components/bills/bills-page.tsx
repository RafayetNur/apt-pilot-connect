import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { AdjustmentsSection } from "@/components/bills/adjustments-section";
import { SharedChargeDialog } from "@/components/bills/shared-charge-dialog";
import { MonthClosingSection } from "@/components/closings/month-closing-section";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildingsQueryOptions } from "@/lib/buildings";
import {
  billEntryRowsQueryOptions,
  bulkChargeTypes,
  deleteSharedCharge,
  flatChargeLabel,
  saveFlatBills,
  sharedCategoryLabel,
  sharedChargesQueryOptions,
  type BillEntryRow,
  type FlatChargeType,
  type SaveBillRowInput,
} from "@/lib/charges";
import { formatRent } from "@/lib/flats";
import { currentMonthInput, formatMonth } from "@/lib/rent";
import { describeClosedMonthError, monthClosureQueryOptions } from "@/lib/closings";
import type { AppRole } from "@/hooks/useAuth";


type Draft = {
  amounts: Record<string, string>;
  notes: string;
};

function toDraft(row: BillEntryRow): Draft {
  const amounts: Record<string, string> = {};
  for (const type of bulkChargeTypes) {
    const value = row.amounts[type];
    amounts[type] = value === undefined ? "" : String(value);
  }
  return { amounts, notes: row.notes };
}

function draftsEqual(a: Draft, b: Draft) {
  if (a.notes !== b.notes) return false;
  return bulkChargeTypes.every((type) => (a.amounts[type] ?? "") === (b.amounts[type] ?? ""));
}

export function BillsPage({ role }: { role: AppRole }) {
  const queryClient = useQueryClient();
  const [buildingId, setBuildingId] = useState("");
  const [month, setMonth] = useState(currentMonthInput());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sharedOpen, setSharedOpen] = useState(false);

  const { data: buildings, isLoading: buildingsLoading } = useQuery(buildingsQueryOptions());
  const buildingList = buildings ?? [];

  useEffect(() => {
    if (!buildingId && buildingList.length > 0) setBuildingId(buildingList[0]!.id);
  }, [buildingId, buildingList]);

  const rowsQuery = useQuery(billEntryRowsQueryOptions(buildingId, month));
  const rows = rowsQuery.data ?? [];
  const sharedQuery = useQuery(sharedChargesQueryOptions(buildingId, month));
  const sharedCharges = sharedQuery.data ?? [];
  const closureQuery = useQuery(monthClosureQueryOptions(buildingId, month));
  const monthClosed = closureQuery.data?.status === "closed";


  const baseline = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const row of rows) map[row.rentRecordId] = toDraft(row);
    return map;
  }, [rows]);

  useEffect(() => {
    setDrafts(baseline);
  }, [baseline]);

  const dirtyIds = Object.keys(drafts).filter((id) => {
    const original = baseline[id];
    const draft = drafts[id];
    if (!original || !draft) return false;
    return !draftsEqual(original, draft);
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const inputs: SaveBillRowInput[] = dirtyIds
        .map((id) => {
          const row = rows.find((item) => item.rentRecordId === id);
          const draft = drafts[id];
          if (!row || !draft || row.locked) return null;
          return {
            rentRecordId: row.rentRecordId,
            buildingId: row.buildingId,
            flatId: row.flatId,
            tenantId: row.tenantId,
            billingMonth: row.billingMonth,
            amounts: draft.amounts as Partial<Record<FlatChargeType, string>>,
            notes: draft.notes,
          } satisfies SaveBillRowInput;
        })
        .filter((item): item is SaveBillRowInput => item !== null);
      if (inputs.length === 0) throw new Error("There are no unsaved editable rows.");
      return saveFlatBills(inputs);
    },
    onSuccess: async () => {
      toast.success("Flat bills saved.");
      await queryClient.invalidateQueries({ queryKey: ["bill-entry-rows"] });
      await queryClient.invalidateQueries({ queryKey: ["rent-records"] });
    },
    onError: (error: Error) => toast.error(describeClosedMonthError(error.message)),
  });

  const deleteSharedMutation = useMutation({
    mutationFn: (id: string) => deleteSharedCharge(id),
    onSuccess: async () => {
      toast.success("Shared charge removed.");
      await queryClient.invalidateQueries({ queryKey: ["shared-charges"] });
      await queryClient.invalidateQueries({ queryKey: ["bill-entry-rows"] });
      await queryClient.invalidateQueries({ queryKey: ["rent-records"] });
    },
    onError: (error: Error) => toast.error(describeClosedMonthError(error.message)),
  });


  const updateAmount = (id: string, type: FlatChargeType, value: string) => {
    setDrafts((previous) => {
      const current = previous[id];
      if (!current) return previous;
      return { ...previous, [id]: { ...current, amounts: { ...current.amounts, [type]: value } } };
    });
  };

  const updateNotes = (id: string, value: string) => {
    setDrafts((previous) => {
      const current = previous[id];
      if (!current) return previous;
      return { ...previous, [id]: { ...current, notes: value } };
    });
  };

  const sharedTotal = sharedCharges.reduce((sum, charge) => sum + charge.total_amount, 0);
  const dashboardPath = role === "owner" ? "/owner/dashboard" : "/manager/dashboard";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Monthly billing
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Flat &amp; shared bills</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Enter the final bill amount printed on each provider bill (DESCO, gas, water, internet).
            AptPilot stores the amount exactly as you type it — it never calculates units or rates.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={dashboardPath}>Back to dashboard</Link>
        </Button>
      </div>

      <section className="panel mt-6 grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="bills-building">Building</Label>
          <Select value={buildingId} onValueChange={setBuildingId}>
            <SelectTrigger id="bills-building">
              <SelectValue placeholder={buildingsLoading ? "Loading…" : "Select a building"} />
            </SelectTrigger>
            <SelectContent>
              {buildingList.map((building) => (
                <SelectItem key={building.id} value={building.id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bills-month">Billing month</Label>
          <Input
            id="bills-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </section>

      {buildingList.length === 0 && !buildingsLoading ? (
        <p className="panel mt-6 p-6 text-sm text-muted-foreground">
          No buildings are available to you yet.
        </p>
      ) : null}

      <section className="panel mt-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Individual flat bills</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {month ? formatMonth(`${month}-01`) : "—"} · {rows.length} billed flat
              {rows.length === 1 ? "" : "s"}
            </p>
            {monthClosed ? (
              <p className="mt-1 text-sm text-muted-foreground">
                This month is closed and finalized. Post a bill adjustment to the next open month
                instead of editing these amounts.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {monthClosed ? <Badge variant="secondary">Month closed</Badge> : null}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={dirtyIds.length === 0 || saveMutation.isPending || monthClosed}
            >
              {saveMutation.isPending
                ? "Saving…"
                : `Save all${dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}`}
            </Button>
          </div>
        </div>


        {rowsQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading billed flats…</p>
        ) : rowsQuery.error ? (
          <p className="mt-4 text-sm text-destructive">
            Could not load bills: {(rowsQuery.error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
            No rent records exist for this building and month, so there is nothing to bill yet.
            Generate monthly rent first.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Flat</th>
                  <th className="py-2 pr-3">Tenant</th>
                  {bulkChargeTypes.map((type) => (
                    <th key={type} className="py-2 pr-3">
                      {flatChargeLabel[type]}
                    </th>
                  ))}
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Total payable</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const draft = drafts[row.rentRecordId] ?? toDraft(row);
                  const original = baseline[row.rentRecordId];
                  const unsaved = original ? !draftsEqual(original, draft) : false;
                  return (
                    <tr key={row.rentRecordId} className="border-t border-border/60 align-top">
                      <td className="py-2 pr-3 font-medium">{row.flatNumber}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.tenantName}</td>
                      {bulkChargeTypes.map((type) => (
                        <td key={type} className="py-2 pr-3">
                          <Input
                            className="h-9 w-24"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`${flatChargeLabel[type]} amount for flat ${row.flatNumber}`}
                            value={draft.amounts[type] ?? ""}
                            disabled={row.locked}
                            onChange={(event) =>
                              updateAmount(row.rentRecordId, type, event.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="py-2 pr-3">
                        <Input
                          className="h-9 w-40"
                          aria-label={`Notes for flat ${row.flatNumber}`}
                          value={draft.notes}
                          maxLength={200}
                          disabled={row.locked}
                          onChange={(event) => updateNotes(row.rentRecordId, event.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{formatRent(row.totalPayable)}</p>
                        <p className="text-xs text-muted-foreground">
                          Rent {formatRent(row.baseRent)} · Shared {formatRent(row.sharedTotal)}
                        </p>
                      </td>
                      <td className="py-2">
                        {row.locked ? (
                          <div className="max-w-[12rem]">
                            <Badge variant="secondary">Locked</Badge>
                            <p className="mt-1 text-xs text-muted-foreground">{row.lockReason}</p>
                          </div>
                        ) : unsaved ? (
                          <Badge variant="outline">Unsaved</Badge>
                        ) : (
                          <Badge variant="default">Saved</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel mt-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Shared building charges</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Split equally among occupied flats that have a rent record for the month. Total added
              this month: {formatRent(sharedTotal)}
            </p>
          </div>
          <Button onClick={() => setSharedOpen(true)} disabled={!buildingId || !month}>
            Add shared charge
          </Button>
        </div>

        {sharedQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading shared charges…</p>
        ) : sharedCharges.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
            No shared charge has been added for this month yet.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {sharedCharges.map((charge) => {
              const allocatedTotal = charge.allocations.reduce(
                (sum, allocation) => sum + allocation.allocated_amount,
                0,
              );
              return (
                <li key={charge.id} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {sharedCategoryLabel[charge.category]} · {formatRent(charge.total_amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Split across {charge.allocations.length} flat
                        {charge.allocations.length === 1 ? "" : "s"} · allocated{" "}
                        {formatRent(allocatedTotal)}
                      </p>
                      {charge.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{charge.description}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleteSharedMutation.isPending}
                      onClick={() => deleteSharedMutation.mutate(charge.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {charge.allocations.map((allocation) => (
                      <span
                        key={allocation.id}
                        className="rounded-lg bg-surface px-2 py-1 text-muted-foreground"
                      >
                        Flat {allocation.flat_number}:{" "}
                        <span className="font-medium text-foreground">
                          {formatRent(allocation.allocated_amount)}
                        </span>
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AdjustmentsSection buildingId={buildingId} month={month} />

      <SharedChargeDialog
        open={sharedOpen}
        onOpenChange={setSharedOpen}
        buildingId={buildingId}
        month={month}
      />
    </div>
  );
}
