import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import type { AppRole } from "@/hooks/useAuth";
import type { Building } from "@/lib/buildings";
import { monthClosureQueryOptions } from "@/lib/closings";
import {
  createExpense,
  expenseCategoryLabel,
  expenseCategoryOptions,
  expenseMethodLabel,
  expenseMethodOptions,
  methodsRequiringReference,
  updatePendingExpense,
  validateExpenseInput,
  type BuildingExpense,
  type ExpenseCategory,
  type ExpenseInput,
  type ExpensePaymentMethod,
} from "@/lib/expenses";
import { currentMonthInput, formatMonth } from "@/lib/rent";

type FormState = {
  buildingId: string;
  expenseDate: string;
  accountingMonth: string;
  relatedMonth: string;
  category: ExpenseCategory;
  description: string;
  vendorName: string;
  amount: string;
  paymentMethod: ExpensePaymentMethod;
  transactionReference: string;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function initialState(
  buildingId: string,
  month: string,
  expense: BuildingExpense | null,
): FormState {
  if (expense) {
    return {
      buildingId: expense.building_id,
      expenseDate: expense.expense_date,
      accountingMonth: expense.accounting_month.slice(0, 7),
      relatedMonth: expense.related_month ? expense.related_month.slice(0, 7) : "",
      category: expense.category,
      description: expense.description,
      vendorName: expense.vendor_name ?? "",
      amount: String(expense.amount),
      paymentMethod: expense.payment_method,
      transactionReference: expense.transaction_reference ?? "",
    };
  }
  return {
    buildingId,
    expenseDate: todayInput(),
    accountingMonth: month || currentMonthInput(),
    relatedMonth: "",
    category: "maintenance",
    description: "",
    vendorName: "",
    amount: "",
    paymentMethod: "cash",
    transactionReference: "",
  };
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  role,
  buildings,
  defaultBuildingId,
  defaultMonth,
  expense = null,
  replacesExpense = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: AppRole;
  buildings: Building[];
  defaultBuildingId: string;
  defaultMonth: string;
  /** Editing an own pending expense. */
  expense?: BuildingExpense | null;
  /** Recording a corrected replacement for a cancelled expense. */
  replacesExpense?: BuildingExpense | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() =>
    initialState(defaultBuildingId, defaultMonth, expense),
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const source = expense ?? replacesExpense;
    setForm(initialState(defaultBuildingId, defaultMonth, source));
    setFile(null);
    setError("");
  }, [open, expense, replacesExpense, defaultBuildingId, defaultMonth]);

  const closureQuery = useQuery({
    ...monthClosureQueryOptions(form.buildingId, form.accountingMonth),
    enabled: open && Boolean(form.buildingId) && Boolean(form.accountingMonth),
  });
  const monthClosed = closureQuery.data?.status === "closed";

  const amountValue = Number(form.amount);
  const input: ExpenseInput = useMemo(
    () => ({
      buildingId: form.buildingId,
      expenseDate: form.expenseDate,
      accountingMonth: form.accountingMonth,
      relatedMonth: form.relatedMonth,
      category: form.category,
      description: form.description,
      vendorName: form.vendorName,
      amount: amountValue,
      paymentMethod: form.paymentMethod,
      transactionReference: form.transactionReference,
      receiptFile: file,
      receiptPath: expense?.receipt_document_url ?? null,
      approveImmediately: role === "owner" && !expense,
      replacesExpenseId: replacesExpense?.id ?? null,
    }),
    [form, amountValue, file, expense, role, replacesExpense],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (expense) return updatePendingExpense(expense.id, input);
      return createExpense(input);
    },
    onSuccess: async () => {
      toast.success(
        expense
          ? "Expense updated."
          : role === "owner"
            ? "Expense recorded and approved."
            : "Expense submitted for owner approval.",
      );
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["building-expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["building-expenses-month"] }),
      ]);
    },
    onError: (err: Error) => setError(err.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const handleSubmit = () => {
    if (monthClosed) {
      setError(
        "That accounting month is closed. Choose the next open month and set the related month to the historical one.",
      );
      return;
    }
    const invalid = validateExpenseInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    mutation.mutate();
  };

  const referenceRequired = methodsRequiringReference.includes(form.paymentMethod);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {expense
              ? "Edit pending expense"
              : replacesExpense
                ? "Record corrected replacement expense"
                : "Add building expense"}
          </DialogTitle>
          <DialogDescription>
            Expenses are accounting records only — they never change tenant bills, rent records or
            shared charges.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="expense-building">Building</Label>
            <Select
              value={form.buildingId}
              onValueChange={(value) => set("buildingId", value)}
              disabled={Boolean(expense)}
            >
              <SelectTrigger id="expense-building">
                <SelectValue placeholder="Select a building" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-date">Expense date</Label>
            <Input
              id="expense-date"
              type="date"
              value={form.expenseDate}
              onChange={(event) => set("expenseDate", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-month">Posted accounting month</Label>
            <Input
              id="expense-month"
              type="month"
              value={form.accountingMonth}
              onChange={(event) => set("accountingMonth", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-related-month">Related month (optional)</Label>
            <Input
              id="expense-related-month"
              type="month"
              value={form.relatedMonth}
              onChange={(event) => set("relatedMonth", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use this for a late expense that belongs to an already-closed month.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(value) => set("category", value as ExpenseCategory)}
            >
              <SelectTrigger id="expense-category">
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

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="expense-description">Description</Label>
            <Textarea
              id="expense-description"
              rows={2}
              maxLength={400}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-vendor">Vendor / payee (optional)</Label>
            <Input
              id="expense-vendor"
              maxLength={120}
              value={form.vendorName}
              onChange={(event) => set("vendorName", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount (৳)</Label>
            <Input
              id="expense-amount"
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(event) => set("amount", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-method">Payment method</Label>
            <Select
              value={form.paymentMethod}
              onValueChange={(value) => set("paymentMethod", value as ExpensePaymentMethod)}
            >
              <SelectTrigger id="expense-method">
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
            <Label htmlFor="expense-reference">
              Transaction / cheque reference{referenceRequired ? "" : " (optional)"}
            </Label>
            <Input
              id="expense-reference"
              maxLength={120}
              value={form.transactionReference}
              onChange={(event) => set("transactionReference", event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="expense-receipt">Receipt (PDF, JPG or PNG, max 5 MB)</Label>
            <Input
              id="expense-receipt"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {expense?.receipt_document_url && !file ? (
              <p className="text-xs text-muted-foreground">
                A receipt is already attached — upload a new file only to replace it.
              </p>
            ) : null}
          </div>
        </div>

        {monthClosed ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
            {formatMonth(`${form.accountingMonth}-01`)} is closed for this building. Post this
            expense into the next open month and record the closed month as the related month.
          </p>
        ) : null}

        {role === "owner" && !expense ? (
          <p className="text-xs text-muted-foreground">
            As the building owner you are the final financial authority, so this entry is recorded
            as approved immediately.
          </p>
        ) : null}
        {role === "manager" && !expense ? (
          <p className="text-xs text-muted-foreground">
            Manager entries are saved as pending and must be approved by the owner — you cannot
            approve your own expense.
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || monthClosed}>
            {mutation.isPending ? "Saving…" : expense ? "Save changes" : "Save expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
