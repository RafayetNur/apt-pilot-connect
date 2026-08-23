import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DetailRow, useInvalidateMaintenance } from "@/components/maintenance/parts";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatRent } from "@/lib/flats";
import { currentMonthInput, formatDate } from "@/lib/rent";
import {
  expenseCategoryLabel,
  expenseCategoryOptions,
  expenseMethodLabel,
  expenseMethodOptions,
} from "@/lib/expenses";
import {
  createExpenseDraftFromWorkOrder,
  createWorkOrder,
  formatDateTime,
  updateWorkOrderStatus,
  workOrderStatusLabel,
  workOrderTransitions,
  workOrdersQueryOptions,
  type WorkOrder,
  type WorkOrderInput,
  type WorkOrderStatus,
} from "@/lib/maintenance";

const emptyInput: WorkOrderInput = {
  workDescription: "",
  assignedManagerId: null,
  vendorName: "",
  vendorPhone: "",
  technicianName: "",
  scheduledDate: "",
  scheduledTime: "",
  estimatedCost: "",
};

export function WorkOrderSection({
  requestId,
  canManage,
  assignable,
}: {
  requestId: string;
  canManage: boolean;
  assignable: Array<{ id: string; full_name: string; role: string }>;
}) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateMaintenance(requestId);
  const workOrdersQuery = useQuery(workOrdersQueryOptions(requestId));
  const workOrders = workOrdersQuery.data ?? [];

  const [creating, setCreating] = useState(false);
  const [input, setInput] = useState<WorkOrderInput>(emptyInput);
  const [statusTarget, setStatusTarget] = useState<{
    order: WorkOrder;
    status: WorkOrderStatus;
  } | null>(null);
  const [expenseTarget, setExpenseTarget] = useState<WorkOrder | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createWorkOrder(requestId, input),
    onSuccess: async () => {
      toast.success("Work order created.");
      setInput(emptyInput);
      setCreating(false);
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["work-orders", requestId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">Work orders</h3>
        {canManage ? (
          <Button size="sm" variant="outline" onClick={() => setCreating((value) => !value)}>
            {creating ? "Close form" : "Add work order"}
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Work-order costs are operational information only. They never appear in financial reports
        until someone explicitly creates an expense draft and it is approved.
      </p>

      {creating ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-surface p-3">
          <div className="space-y-2">
            <Label htmlFor="wo-description">Work description</Label>
            <Textarea
              id="wo-description"
              rows={3}
              value={input.workDescription}
              onChange={(event) => setInput({ ...input, workDescription: event.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wo-manager">Responsible person</Label>
              <Select
                value={input.assignedManagerId ?? "none"}
                onValueChange={(value) =>
                  setInput({ ...input, assignedManagerId: value === "none" ? null : value })
                }
              >
                <SelectTrigger id="wo-manager">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned yet (draft)</SelectItem>
                  {assignable.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-vendor">Vendor name</Label>
              <Input
                id="wo-vendor"
                value={input.vendorName}
                onChange={(event) => setInput({ ...input, vendorName: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-vendor-phone">Vendor phone (never shown to tenants)</Label>
              <Input
                id="wo-vendor-phone"
                value={input.vendorPhone}
                onChange={(event) => setInput({ ...input, vendorPhone: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-technician">Technician name</Label>
              <Input
                id="wo-technician"
                value={input.technicianName}
                onChange={(event) => setInput({ ...input, technicianName: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-date">Scheduled date</Label>
              <Input
                id="wo-date"
                type="date"
                value={input.scheduledDate}
                onChange={(event) => setInput({ ...input, scheduledDate: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-time">Scheduled time</Label>
              <Input
                id="wo-time"
                placeholder="e.g. 10:00 – 12:00"
                value={input.scheduledTime}
                onChange={(event) => setInput({ ...input, scheduledTime: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-estimate">Estimated cost (BDT)</Label>
              <Input
                id="wo-estimate"
                type="number"
                min="0"
                step="0.01"
                value={input.estimatedCost}
                onChange={(event) => setInput({ ...input, estimatedCost: event.target.value })}
              />
            </div>
          </div>
          <Button
            size="sm"
            disabled={createMutation.isPending || input.workDescription.trim().length < 3}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Saving…" : "Create work order"}
          </Button>
        </div>
      ) : null}

      {workOrdersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading work orders…</p>
      ) : workOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No work order has been created yet.</p>
      ) : (
        <ul className="space-y-3">
          {workOrders.map((order) => (
            <li key={order.id} className="rounded-xl border border-border/60 bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{order.work_order_number}</p>
                <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                  {workOrderStatusLabel[order.status]}
                </Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{order.work_description}</p>
              <div className="mt-2">
                <DetailRow label="Responsible" value={order.manager_name ?? "Not assigned"} />
                <DetailRow label="Vendor" value={order.vendor_name ?? "—"} />
                <DetailRow label="Vendor phone" value={order.vendor_phone ?? "—"} />
                <DetailRow label="Technician" value={order.technician_name ?? "—"} />
                <DetailRow
                  label="Scheduled"
                  value={
                    order.scheduled_date
                      ? `${formatDate(order.scheduled_date)}${order.scheduled_time ? ` · ${order.scheduled_time}` : ""}`
                      : "Not scheduled"
                  }
                />
                <DetailRow
                  label="Estimated cost"
                  value={order.estimated_cost == null ? "—" : formatRent(order.estimated_cost)}
                />
                <DetailRow
                  label="Actual cost"
                  value={order.actual_cost == null ? "—" : formatRent(order.actual_cost)}
                />
                {order.completed_at ? (
                  <DetailRow label="Completed" value={formatDateTime(order.completed_at)} />
                ) : null}
                {order.completion_note ? (
                  <DetailRow label="Completion note" value={order.completion_note} />
                ) : null}
                {order.cancellation_reason ? (
                  <DetailRow label="Cancellation reason" value={order.cancellation_reason} />
                ) : null}
                {order.expense_id ? (
                  <DetailRow
                    label="Linked expense"
                    value={`Created · ${order.expense_status ?? "pending"}`}
                  />
                ) : null}
              </div>

              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {workOrderTransitions[order.status].map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === "cancelled" ? "outline" : "default"}
                      onClick={() => setStatusTarget({ order, status: next })}
                    >
                      {next === "completed"
                        ? "Mark completed"
                        : next === "cancelled"
                          ? "Cancel"
                          : `Move to ${workOrderStatusLabel[next].toLowerCase()}`}
                    </Button>
                  ))}
                  {order.status === "completed" && !order.expense_id ? (
                    <Button size="sm" variant="outline" onClick={() => setExpenseTarget(order)}>
                      Create expense draft
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <WorkOrderStatusDialog
        target={statusTarget}
        onClose={() => setStatusTarget(null)}
        onDone={async () => {
          await invalidate();
          await queryClient.invalidateQueries({ queryKey: ["work-orders", requestId] });
        }}
      />

      <ExpenseDraftDialog
        order={expenseTarget}
        onClose={() => setExpenseTarget(null)}
        onDone={async () => {
          await queryClient.invalidateQueries({ queryKey: ["work-orders", requestId] });
          await queryClient.invalidateQueries({ queryKey: ["building-expenses"] });
        }}
      />
    </div>
  );
}

function WorkOrderStatusDialog({
  target,
  onClose,
  onDone,
}: {
  target: { order: WorkOrder; status: WorkOrderStatus } | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [actualCost, setActualCost] = useState("");

  const needsNote = target?.status === "completed" || target?.status === "cancelled";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) return;
      const cost = actualCost.trim() ? Number(actualCost) : null;
      if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
        throw new Error("Actual cost cannot be negative.");
      }
      await updateWorkOrderStatus(target.order.id, target.status, note, cost);
    },
    onSuccess: async () => {
      toast.success("Work order updated.");
      setNote("");
      setActualCost("");
      onClose();
      await onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target ? `Move ${target.order.work_order_number} to ${workOrderStatusLabel[target.status].toLowerCase()}` : ""}
          </DialogTitle>
          <DialogDescription>
            Every work-order change is recorded with your name and the time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {target?.status === "completed" ? (
            <div className="space-y-2">
              <Label htmlFor="wo-actual">Actual cost (BDT, optional)</Label>
              <Input
                id="wo-actual"
                type="number"
                min="0"
                step="0.01"
                value={actualCost}
                onChange={(event) => setActualCost(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="wo-note">
              {target?.status === "cancelled"
                ? "Cancellation reason (required)"
                : target?.status === "completed"
                  ? "Completion note (required)"
                  : "Note (optional)"}
            </Label>
            <Textarea
              id="wo-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {target?.status === "completed" ? (
            <p className="text-xs text-muted-foreground">
              Completing this work order does not resolve the maintenance request while other work
              orders are still open, and it never creates an expense on its own.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || (needsNote && !note.trim())}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDraftDialog({
  order,
  onClose,
  onDone,
}: {
  order: WorkOrder | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [category, setCategory] = useState("repair");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountingMonth, setAccountingMonth] = useState(currentMonthInput());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter the amount actually spent.");
      await createExpenseDraftFromWorkOrder({
        workOrderId: order.id,
        category,
        amount: value,
        description:
          description.trim() || `${order.work_order_number} · ${order.work_description.slice(0, 80)}`,
        expenseDate,
        accountingMonth,
        paymentMethod,
        vendorName: order.vendor_name ?? "",
        transactionReference: reference,
      });
    },
    onSuccess: async () => {
      toast.success("Pending expense draft created. It needs approval before it counts anywhere.");
      onClose();
      await onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={(open) => {
        if (!open) onClose();
        else if (order) {
          setAmount(order.actual_cost != null ? String(order.actual_cost) : "");
          setReference("");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create expense draft</DialogTitle>
          <DialogDescription>
            This creates one pending building expense linked to this work order. Nothing is created
            automatically and it will not count in reports until it is approved under the existing
            expense rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ed-amount">Amount actually spent (BDT)</Label>
              <Input
                id="ed-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-category">Expense category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="ed-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategoryOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {expenseCategoryLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-date">Expense date</Label>
              <Input
                id="ed-date"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-month">Accounting month</Label>
              <Input
                id="ed-month"
                type="month"
                value={accountingMonth}
                onChange={(event) => setAccountingMonth(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-method">Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="ed-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseMethodOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {expenseMethodLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-reference">Transaction reference</Label>
              <Input
                id="ed-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-description">Description</Label>
            <Textarea
              id="ed-description"
              rows={2}
              value={description}
              placeholder={order ? `${order.work_order_number} · repair work` : ""}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Create pending expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
