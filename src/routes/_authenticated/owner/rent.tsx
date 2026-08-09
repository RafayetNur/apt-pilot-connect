import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MonthClosingSection } from "@/components/closings/month-closing-section";
import { OwnerShell } from "@/components/owner-shell";
import { GenerateRentDialog, type GenerateRentValues } from "@/components/rent/generate-rent-dialog";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildingsQueryOptions } from "@/lib/buildings";
import { formatRent } from "@/lib/flats";
import {
  formatDate,
  formatMonth,
  generateMonthlyRent,
  paymentStatusLabel,
  rentRecordsQueryOptions,
  type PaymentStatus,
  type RentFilters,
} from "@/lib/rent";

export const Route = createFileRoute("/_authenticated/owner/rent")({
  head: () => ({
    meta: [
      { title: "Monthly rent — AptPilot" },
      {
        name: "description",
        content:
          "Generate and review monthly rent records for occupied flats across your AptPilot buildings.",
      },
      { property: "og:title", content: "Monthly rent — AptPilot" },
      {
        property: "og:description",
        content: "Owner rent register with billing month, base rent, due date and payment status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerRentPage,
});

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partially_paid: "outline",
  unpaid: "secondary",
  overdue: "destructive",
};

function OwnerRentPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<RentFilters>({
    buildingId: "all",
    month: "",
    status: "all",
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: buildings } = useQuery(buildingsQueryOptions());
  const { data: records, isLoading, error } = useQuery(rentRecordsQueryOptions(filters));

  const rows = records ?? [];

  const summary = useMemo(() => {
    const expected = rows.reduce((sum, row) => sum + row.base_rent, 0);
    const paid = rows.reduce((sum, row) => sum + row.total_paid, 0);
    const unpaid = rows.reduce((sum, row) => sum + row.remaining_due, 0);
    const flats = new Set(rows.map((row) => row.flat_id)).size;
    return { expected, paid, unpaid, flats };
  }, [rows]);

  const generateMutation = useMutation({
    mutationFn: async (values: GenerateRentValues) =>
      generateMonthlyRent({
        buildingId: values.buildingId,
        month: values.month,
        dueDate: values.dueDate,
      }),
    onSuccess: async (result) => {
      setDialogOpen(false);
      if (result.eligible === 0) {
        toast.info("No occupied flats with an assigned tenant were found in this building.");
      } else {
        toast.success(
          `${result.created} rent record${result.created === 1 ? "" : "s"} created, ${result.skipped} skipped (already billed).`
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["rent-records"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <OwnerShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Rent</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate monthly rent for occupied flats. Payment status changes only through verified
            payments on the Payments page.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate monthly rent
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total rent expected" value={formatRent(summary.expected)} />
        <SummaryCard label="Total paid (verified)" value={formatRent(summary.paid)} />
        <SummaryCard label="Total remaining due" value={formatRent(summary.unpaid)} />
        <SummaryCard label="Occupied flats billed" value={String(summary.flats)} />
      </div>

      <section className="panel mt-6 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="filter-building">Building</Label>
            <Select
              value={filters.buildingId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, buildingId: value }))}
            >
              <SelectTrigger id="filter-building">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buildings</SelectItem>
                {(buildings ?? []).map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-month">Month</Label>
            <Input
              id="filter-month"
              type="month"
              value={filters.month}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, month: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-status">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value as RentFilters["status"] }))
              }
            >
              <SelectTrigger id="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="panel mt-6 p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rent records…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            Could not load rent records: {(error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-display text-lg font-semibold">No rent records</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate monthly rent for a building to see records here.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Billing month</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Flat</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Base rent</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {formatMonth(row.billing_month)}
                      </TableCell>
                      <TableCell>{row.building_name}</TableCell>
                      <TableCell>{row.flat_number}</TableCell>
                      <TableCell>{row.tenant_name}</TableCell>
                      <TableCell>{formatRent(row.base_rent)}</TableCell>
                      <TableCell>{formatRent(row.total_paid)}</TableCell>
                      <TableCell>{formatRent(row.remaining_due)}</TableCell>
                      <TableCell>{formatDate(row.due_date)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[row.payment_status]}>
                          {paymentStatusLabel[row.payment_status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold">
                        {formatMonth(row.billing_month)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.building_name} · Flat {row.flat_number}
                      </p>
                      <p className="text-sm text-muted-foreground">{row.tenant_name}</p>
                    </div>
                    <Badge variant={statusVariant[row.payment_status]}>
                      {paymentStatusLabel[row.payment_status]}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm">
                    <p className="font-medium">{formatRent(row.base_rent)} base rent</p>
                    <p className="text-muted-foreground">
                      Paid {formatRent(row.total_paid)} · Remaining {formatRent(row.remaining_due)}
                    </p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(row.due_date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <GenerateRentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        buildings={buildings ?? []}
        saving={generateMutation.isPending}
        onSubmit={(values) => generateMutation.mutate(values)}
      />
    </OwnerShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
