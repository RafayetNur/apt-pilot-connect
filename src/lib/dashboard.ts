import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { monthToDate, type PaymentStatus } from "@/lib/rent";
import type { PaymentMethod, VerificationStatus } from "@/lib/payments";

export type DashboardBuilding = {
  id: string;
  name: string;
  status: string;
};

export type DashboardFlat = {
  id: string;
  building_id: string;
  occupancy_status: "vacant" | "occupied";
  tenant_id: string | null;
};

export type DashboardRecord = {
  id: string;
  building_id: string;
  building_name: string;
  flat_id: string;
  flat_number: string;
  tenant_id: string;
  tenant_name: string;
  billing_month: string;
  due_date: string;
  base_rent: number;
  individual_charges_total: number;
  shared_charges_total: number;
  total_payable: number;
  total_paid: number;
  remaining_due: number;
  payment_status: PaymentStatus;
};

export type DashboardPayment = {
  id: string;
  building_id: string;
  building_name: string;
  flat_number: string;
  tenant_name: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  verification_status: VerificationStatus;
  submitted_at: string;
  verified_at: string | null;
  receipt_number: string | null;
};

export type BuildingSummary = {
  id: string;
  name: string;
  totalFlats: number;
  occupied: number;
  vacant: number;
  payable: number;
  collected: number;
  remaining: number;
};

export type DashboardSummary = {
  buildings: DashboardBuilding[];
  flats: DashboardFlat[];
  records: DashboardRecord[];
  payments: DashboardPayment[];
  totals: {
    totalBuildings: number;
    totalFlats: number;
    occupied: number;
    vacant: number;
    occupancyPct: number;
    totalPayable: number;
    collected: number;
    remaining: number;
    overdue: number;
    pendingVerifications: number;
    availableCredit: number;
  };
  buildingSummaries: BuildingSummary[];
  needsChargeEntry: DashboardRecord[];
  outstanding: DashboardRecord[];
  recentSubmissions: DashboardPayment[];
  latestVerified: DashboardPayment[];
};

function num(value: unknown) {
  return Number(value ?? 0);
}

export const dashboardSummaryQueryOptions = (month: string) =>
  queryOptions({
    queryKey: ["dashboard-summary", month],
    queryFn: async (): Promise<DashboardSummary> => {
      const billingMonth = monthToDate(month);

      const [buildingsRes, flatsRes, recordsRes, paymentsRes, creditsRes] = await Promise.all([
        supabase.from("buildings").select("id, name, status").order("name"),
        supabase.from("flats").select("id, building_id, occupancy_status, tenant_id"),
        supabase
          .from("rent_records")
          .select(
            "id, building_id, flat_id, tenant_id, billing_month, due_date, base_rent, individual_charges_total, shared_charges_total, total_payable, total_paid, remaining_due, payment_status, buildings(name), flats(flat_number), profiles(full_name)",
          )
          .eq("billing_month", billingMonth),
        supabase
          .from("rent_payments")
          .select(
            "id, building_id, amount_paid, payment_method, verification_status, submitted_at, verified_at, receipt_number, buildings(name), flats(flat_number), tenant:profiles!rent_payments_tenant_id_fkey(full_name)",
          )
          .order("submitted_at", { ascending: false })
          .limit(60),
        supabase.from("tenant_credits").select("remaining_amount"),
      ]);

      for (const res of [buildingsRes, flatsRes, recordsRes, paymentsRes, creditsRes]) {
        if (res.error) throw res.error;
      }

      const buildings = (buildingsRes.data ?? []) as DashboardBuilding[];
      const flats = (flatsRes.data ?? []) as DashboardFlat[];

      const records: DashboardRecord[] = (recordsRes.data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          buildings?: { name: string } | null;
          flats?: { flat_number: string } | null;
          profiles?: { full_name: string } | null;
        };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          building_name: row.buildings?.name ?? "—",
          flat_id: row["flat_id"] as string,
          flat_number: row.flats?.flat_number ?? "—",
          tenant_id: row["tenant_id"] as string,
          tenant_name: row.profiles?.full_name ?? "—",
          billing_month: row["billing_month"] as string,
          due_date: row["due_date"] as string,
          base_rent: num(row["base_rent"]),
          individual_charges_total: num(row["individual_charges_total"]),
          shared_charges_total: num(row["shared_charges_total"]),
          total_payable: num(row["total_payable"]),
          total_paid: num(row["total_paid"]),
          remaining_due: num(row["remaining_due"]),
          payment_status: row["payment_status"] as PaymentStatus,
        };
      });

      const payments: DashboardPayment[] = (paymentsRes.data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          buildings?: { name: string } | null;
          flats?: { flat_number: string } | null;
          tenant?: { full_name: string } | null;
        };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          building_name: row.buildings?.name ?? "—",
          flat_number: row.flats?.flat_number ?? "—",
          tenant_name: row.tenant?.full_name ?? "—",
          amount_paid: num(row["amount_paid"]),
          payment_method: row["payment_method"] as PaymentMethod,
          verification_status: row["verification_status"] as VerificationStatus,
          submitted_at: row["submitted_at"] as string,
          verified_at: (row["verified_at"] as string | null) ?? null,
          receipt_number: (row["receipt_number"] as string | null) ?? null,
        };
      });

      const availableCredit = (creditsRes.data ?? []).reduce(
        (sum, row) => sum + num((row as Record<string, unknown>)["remaining_amount"]),
        0,
      );

      const today = new Date().toISOString().slice(0, 10);
      const occupied = flats.filter((flat) => flat.occupancy_status === "occupied").length;
      const totalFlats = flats.length;

      const totalPayable = records.reduce((sum, row) => sum + row.total_payable, 0);
      const collected = records.reduce((sum, row) => sum + row.total_paid, 0);
      const remaining = records.reduce((sum, row) => sum + row.remaining_due, 0);
      const overdue = records
        .filter((row) => row.remaining_due > 0 && row.due_date < today)
        .reduce((sum, row) => sum + row.remaining_due, 0);

      const buildingSummaries: BuildingSummary[] = buildings.map((building) => {
        const buildingFlats = flats.filter((flat) => flat.building_id === building.id);
        const buildingRecords = records.filter((row) => row.building_id === building.id);
        const occupiedCount = buildingFlats.filter(
          (flat) => flat.occupancy_status === "occupied",
        ).length;
        return {
          id: building.id,
          name: building.name,
          totalFlats: buildingFlats.length,
          occupied: occupiedCount,
          vacant: buildingFlats.length - occupiedCount,
          payable: buildingRecords.reduce((sum, row) => sum + row.total_payable, 0),
          collected: buildingRecords.reduce((sum, row) => sum + row.total_paid, 0),
          remaining: buildingRecords.reduce((sum, row) => sum + row.remaining_due, 0),
        };
      });

      return {
        buildings,
        flats,
        records,
        payments,
        totals: {
          totalBuildings: buildings.length,
          totalFlats,
          occupied,
          vacant: totalFlats - occupied,
          occupancyPct: totalFlats > 0 ? Math.round((occupied / totalFlats) * 100) : 0,
          totalPayable,
          collected,
          remaining,
          overdue,
          pendingVerifications: payments.filter((p) => p.verification_status === "pending").length,
          availableCredit,
        },
        buildingSummaries,
        needsChargeEntry: records.filter((row) => row.individual_charges_total === 0),
        outstanding: records
          .filter((row) => row.remaining_due > 0)
          .sort((a, b) => b.remaining_due - a.remaining_due),
        recentSubmissions: payments.slice(0, 6),
        latestVerified: payments.filter((p) => p.verification_status === "verified").slice(0, 6),
      };
    },
  });
