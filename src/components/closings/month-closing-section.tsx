import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  closeBuildingMonth,
  closingChecklistQueryOptions,
  closureEventsQueryOptions,
  closureStatusLabel,
  monthClosureQueryOptions,
  reopenBuildingMonth,
  type MonthClosureStatus,
} from "@/lib/closings";
import { formatRent } from "@/lib/flats";
import { formatDateTime } from "@/lib/payments";
import { formatMonth } from "@/lib/rent";

export const closureBadgeVariant: Record<MonthClosureStatus, "default" | "secondary" | "outline"> = {
  open: "secondary",
  closed: "default",
  reopened: "outline",
};

export function MonthStatusBadge({ status }: { status: MonthClosureStatus }) {
  return <Badge variant={closureBadgeVariant[status]}>{closureStatusLabel[status]}</Badge>;
}

function ChecklistRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function MonthClosingSection({
  buildingId,
  month,
  canManage,
}: {
  buildingId: string;
  month: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  const closureQuery = useQuery(monthClosureQueryOptions(buildingId, month));
  const checklistQuery = useQuery(closingChecklistQueryOptions(buildingId, month));
  const eventsQuery = useQuery(closureEventsQueryOptions(buildingId, month));

  const closure = closureQuery.data;
  const status: MonthClosureStatus = closure?.status ?? "open";
  const checklist = checklistQuery.data;
  const blockers = checklist?.blockers ?? [];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["month-closure"] }),
      queryClient.invalidateQueries({ queryKey: ["month-closures"] }),
      queryClient.invalidateQueries({ queryKey: ["month-closure-events"] }),
      queryClient.invalidateQueries({ queryKey: ["closing-checklist"] }),
    ]);
  };

  const closeMutation = useMutation({
    mutationFn: async () => closeBuildingMonth(buildingId, month, note),
    onSuccess: async () => {
      setCloseOpen(false);
      setNote("");
      toast.success("Month closed. Bill components for this month are now protected.");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: async () => reopenBuildingMonth(buildingId, month, reason),
    onSuccess: async () => {
      setReopenOpen(false);
      setReason("");
      toast.success("Month reopened. The closing history is kept.");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="panel mt-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Monthly closing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {month ? formatMonth(`${month}-01`) : "—"} ·{" "}
            {canManage
              ? "Close the month once bills and payments are reviewed. Unpaid balances stay attached to their original bill."
              : "Read-only status. Only the building owner can close or reopen a month."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthStatusBadge status={status} />
          {canManage && status !== "closed" ? (
            <Button
              onClick={() => setCloseOpen(true)}
              disabled={!buildingId || !month || blockers.length > 0 || checklistQuery.isLoading}
            >
              Close month
            </Button>
          ) : null}
          {canManage && status === "closed" ? (
            <Button variant="outline" onClick={() => setReopenOpen(true)}>
              Reopen month
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-surface p-4 text-sm">
          {checklistQuery.isLoading ? (
            <p className="text-muted-foreground">Loading closing checklist…</p>
          ) : checklistQuery.error ? (
            <p className="text-destructive">
              Could not load the checklist: {(checklistQuery.error as Error).message}
            </p>
          ) : checklist ? (
            <>
              <ChecklistRow label="Rent records" value={String(checklist.rentRecordCount)} />
              <ChecklistRow label="Total payable" value={formatRent(checklist.totalPayable)} />
              <ChecklistRow label="Verified paid" value={formatRent(checklist.verifiedPaid)} />
              <ChecklistRow label="Remaining due" value={formatRent(checklist.remainingDue)} />
              <ChecklistRow label="Overdue amount" value={formatRent(checklist.overdue)} />
              <ChecklistRow
                label="Pending payment submissions"
                value={String(checklist.pendingPayments)}
              />
              <ChecklistRow
                label="Pending bill adjustments"
                value={String(checklist.pendingAdjustments)}
              />
              <ChecklistRow
                label="Occupied flats without rent"
                value={String(checklist.flatsWithoutRent)}
              />
              <ChecklistRow
                label="Billed flats with no manual bill entry"
                value={String(checklist.flatsMissingBills)}
              />
              <ChecklistRow
                label="Shared charges not split"
                value={String(checklist.unallocatedSharedCharges)}
              />
              <ChecklistRow
                label="Records with inconsistent totals"
                value={String(checklist.inconsistentRecords)}
              />
            </>
          ) : (
            <p className="text-muted-foreground">Select a building and month.</p>
          )}
        </div>

        <div className="grid gap-3">
          {blockers.length > 0 ? (
            <div className="rounded-xl border border-destructive/40 bg-card p-4 text-sm">
              <p className="font-medium text-destructive">Closing is blocked</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
              Nothing is blocking this month. Outstanding balances do not block closing — tenants can
              still pay a closed month and receive new receipts.
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
            <p className="font-medium">Closure history</p>
            {eventsQuery.isLoading ? (
              <p className="mt-2 text-muted-foreground">Loading history…</p>
            ) : (eventsQuery.data ?? []).length === 0 ? (
              <p className="mt-2 text-muted-foreground">
                This month has never been closed or reopened.
              </p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {(eventsQuery.data ?? []).map((event) => (
                  <li key={event.id} className="rounded-lg bg-surface p-3">
                    <p className="font-medium">
                      {event.action === "closed" ? "Closed" : "Reopened"} by {event.performer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at)}
                    </p>
                    {event.reason_or_note ? (
                      <p className="mt-1 text-sm">{event.reason_or_note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Close {month ? formatMonth(`${month}-01`) : "this month"}?</DialogTitle>
            <DialogDescription>
              Rent records, individual charges, shared charges and new adjustments for this month
              will be locked. Tenants can still pay their remaining due, and you can still verify
              payments and issue receipts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="closing-note">Closing note (optional)</Label>
            <Textarea
              id="closing-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. All DESCO bills entered and shared charges split."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseOpen(false)}
              disabled={closeMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
              {closeMutation.isPending ? "Closing…" : "Close month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reopen {month ? formatMonth(`${month}-01`) : "this month"}?</DialogTitle>
            <DialogDescription>
              Reopening keeps the full closing history. Verified payments, receipts, credits and
              approved adjustments stay exactly as they are — paid bills still need debit or credit
              adjustments instead of direct edits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reopen-reason">Reopening reason</Label>
            <Textarea
              id="reopen-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Gas bill for this month arrived late and must be added."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReopenOpen(false)}
              disabled={reopenMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending || !reason.trim()}
            >
              {reopenMutation.isPending ? "Reopening…" : "Reopen month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
