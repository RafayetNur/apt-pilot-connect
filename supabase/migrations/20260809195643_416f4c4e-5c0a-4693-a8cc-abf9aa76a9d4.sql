-- Indexes for reporting workloads (none of these duplicate existing indexes)
CREATE INDEX IF NOT EXISTS rent_records_building_month_idx
  ON public.rent_records (building_id, billing_month);
CREATE INDEX IF NOT EXISTS rent_payments_verified_idx
  ON public.rent_payments (building_id, verified_at)
  WHERE verification_status = 'verified'::public.verification_status;
CREATE INDEX IF NOT EXISTS building_expenses_building_month_status_idx
  ON public.building_expenses (building_id, accounting_month, approval_status);
CREATE INDEX IF NOT EXISTS tenant_credits_building_idx
  ON public.tenant_credits (building_id);
CREATE INDEX IF NOT EXISTS shared_charge_allocations_building_idx
  ON public.shared_charge_allocations (building_id);

-- Buildings the caller may report on (owner of the building, or its assigned manager)
CREATE OR REPLACE FUNCTION public.report_accessible_buildings()
RETURNS TABLE (id uuid, name text, is_owner boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id, b.name, public.is_building_owner(b.id, auth.uid())
  FROM public.buildings b
  WHERE auth.uid() IS NOT NULL
    AND public.can_review_building(b.id, auth.uid())
  ORDER BY b.name
$$;

CREATE OR REPLACE FUNCTION public.report_guard(_building_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;
  IF _building_id IS NULL THEN
    RAISE EXCEPTION 'A building is required for this report.';
  END IF;
  IF NOT public.can_review_building(_building_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to view reports for this building.';
  END IF;
END;
$$;

-- A. Monthly building statement (billing performance + cash-basis expenses)
CREATE OR REPLACE FUNCTION public.report_monthly_statement(_building_id uuid, _billing_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m date := date_trunc('month', _billing_month)::date;
  result jsonb;
BEGIN
  PERFORM public.report_guard(_building_id);

  SELECT jsonb_build_object(
    'building_id', _building_id,
    'building_name', (SELECT name FROM public.buildings WHERE id = _building_id),
    'billing_month', m,
    'month_status', coalesce(
      (SELECT c.status::text FROM public.building_month_closures c
        WHERE c.building_id = _building_id AND c.billing_month = m), 'open'),
    'closed_at', (SELECT c.closed_at FROM public.building_month_closures c
        WHERE c.building_id = _building_id AND c.billing_month = m),
    'reopened_at', (SELECT c.reopened_at FROM public.building_month_closures c
        WHERE c.building_id = _building_id AND c.billing_month = m),
    'flats_total', (SELECT count(*) FROM public.flats f WHERE f.building_id = _building_id),
    'flats_occupied', (SELECT count(*) FROM public.flats f
        WHERE f.building_id = _building_id
          AND f.occupancy_status = 'occupied'::public.occupancy_status),
    'rent_records', coalesce(r.records, 0),
    'base_rent', coalesce(r.base_rent, 0),
    'individual_charges', coalesce(r.individual_charges, 0),
    'shared_charges', coalesce(r.shared_charges, 0),
    'adjustments_net', coalesce(r.adjustments, 0),
    'total_billed', coalesce(r.billed, 0),
    'total_paid', coalesce(r.paid, 0),
    'remaining_due', coalesce(r.due, 0),
    'collection_rate', CASE WHEN coalesce(r.billed, 0) > 0
        THEN round(coalesce(r.paid, 0) * 100 / r.billed, 2) ELSE 0 END,
    'credits_held', (SELECT coalesce(sum(tc.remaining_amount), 0) FROM public.tenant_credits tc
        WHERE tc.building_id = _building_id),
    'approved_expenses', (SELECT coalesce(sum(e.amount), 0) FROM public.building_expenses e
        WHERE e.building_id = _building_id AND e.accounting_month = m
          AND e.approval_status = 'approved'::public.expense_approval_status),
    'cash_received_in_month', (SELECT coalesce(sum(p.applied_amount), 0) FROM public.rent_payments p
        WHERE p.building_id = _building_id
          AND p.verification_status = 'verified'::public.verification_status
          AND p.verified_at >= m AND p.verified_at < (m + interval '1 month')),
    'pending_payments', (SELECT count(*) FROM public.rent_payments p
        JOIN public.rent_records rr ON rr.id = p.rent_record_id
        WHERE p.building_id = _building_id AND rr.billing_month = m
          AND p.verification_status = 'pending'::public.verification_status),
    'pending_adjustments', (SELECT count(*) FROM public.bill_adjustments a
        WHERE a.building_id = _building_id AND a.posted_billing_month = m
          AND a.approval_status = 'pending'::public.approval_status),
    'pending_expenses', (SELECT count(*) FROM public.building_expenses e
        WHERE e.building_id = _building_id AND e.accounting_month = m
          AND e.approval_status = 'pending'::public.expense_approval_status),
    'flats_fully_paid', coalesce(r.fully_paid, 0),
    'flats_partially_paid', coalesce(r.partially_paid, 0),
    'flats_unpaid', coalesce(r.unpaid, 0),
    'flats_overdue', coalesce(r.overdue, 0)
  ) INTO result
  FROM (
    SELECT count(*) AS records,
           sum(rr.base_rent) AS base_rent,
           sum(rr.individual_charges_total) AS individual_charges,
           sum(rr.shared_charges_total) AS shared_charges,
           sum(rr.adjustment_total) AS adjustments,
           sum(rr.total_payable) AS billed,
           sum(rr.total_paid) AS paid,
           sum(rr.remaining_due) AS due,
           count(*) FILTER (WHERE rr.remaining_due = 0 AND rr.total_paid > 0) AS fully_paid,
           count(*) FILTER (WHERE rr.total_paid > 0 AND rr.remaining_due > 0) AS partially_paid,
           count(*) FILTER (WHERE rr.total_paid = 0) AS unpaid,
           count(*) FILTER (WHERE rr.remaining_due > 0 AND rr.due_date < current_date) AS overdue
    FROM public.rent_records rr
    WHERE rr.building_id = _building_id AND rr.billing_month = m
  ) r;

  RETURN result;
END;
$$;

-- B. Cash flow report (verified_at based)
CREATE OR REPLACE FUNCTION public.report_cash_flow(_building_id uuid, _from date, _to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  from_ts timestamptz := _from::timestamptz;
  to_ts timestamptz := (_to + 1)::timestamptz;
  from_month date := date_trunc('month', _from)::date;
  to_month date := date_trunc('month', _to)::date;
  result jsonb;
BEGIN
  PERFORM public.report_guard(_building_id);

  SELECT jsonb_build_object(
    'building_id', _building_id,
    'building_name', (SELECT name FROM public.buildings WHERE id = _building_id),
    'date_from', _from,
    'date_to', _to,
    'rent_cash_received', (SELECT coalesce(sum(p.applied_amount), 0) FROM public.rent_payments p
        WHERE p.building_id = _building_id
          AND p.verification_status = 'verified'::public.verification_status
          AND p.verified_at >= from_ts AND p.verified_at < to_ts),
    'credit_created', (SELECT coalesce(sum(p.credit_amount), 0) FROM public.rent_payments p
        WHERE p.building_id = _building_id
          AND p.verification_status = 'verified'::public.verification_status
          AND p.verified_at >= from_ts AND p.verified_at < to_ts),
    'gross_verified_amount', (SELECT coalesce(sum(p.amount_paid), 0) FROM public.rent_payments p
        WHERE p.building_id = _building_id
          AND p.verification_status = 'verified'::public.verification_status
          AND p.verified_at >= from_ts AND p.verified_at < to_ts),
    'approved_expenses', (SELECT coalesce(sum(e.amount), 0) FROM public.building_expenses e
        WHERE e.building_id = _building_id
          AND e.approval_status = 'approved'::public.expense_approval_status
          AND e.accounting_month >= from_month AND e.accounting_month <= to_month),
    'method_breakdown', (SELECT coalesce(jsonb_agg(x ORDER BY (x->>'applied')::numeric DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
                 'method', p.payment_method::text,
                 'applied', sum(p.applied_amount),
                 'credit', sum(p.credit_amount),
                 'count', count(*)) AS x
        FROM public.rent_payments p
        WHERE p.building_id = _building_id
          AND p.verification_status = 'verified'::public.verification_status
          AND p.verified_at >= from_ts AND p.verified_at < to_ts
        GROUP BY p.payment_method) s),
    'expense_breakdown', (SELECT coalesce(jsonb_agg(x ORDER BY (x->>'total')::numeric DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
                 'category', e.category::text,
                 'total', sum(e.amount),
                 'count', count(*)) AS x
        FROM public.building_expenses e
        WHERE e.building_id = _building_id
          AND e.approval_status = 'approved'::public.expense_approval_status
          AND e.accounting_month >= from_month AND e.accounting_month <= to_month
        GROUP BY e.category) s),
    'trend', (SELECT coalesce(jsonb_agg(x ORDER BY (x->>'period')), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
                 'period', to_char(t.period, 'YYYY-MM'),
                 'received', coalesce(t.received, 0),
                 'expenses', coalesce(t.expenses, 0)) AS x
        FROM (
          SELECT gs::date AS period,
            (SELECT coalesce(sum(p.applied_amount), 0) FROM public.rent_payments p
              WHERE p.building_id = _building_id
                AND p.verification_status = 'verified'::public.verification_status
                AND p.verified_at >= greatest(gs, from_ts)
                AND p.verified_at < least(gs + interval '1 month', to_ts)) AS received,
            (SELECT coalesce(sum(e.amount), 0) FROM public.building_expenses e
              WHERE e.building_id = _building_id
                AND e.approval_status = 'approved'::public.expense_approval_status
                AND e.accounting_month = gs::date) AS expenses
          FROM generate_series(from_month::timestamptz, to_month::timestamptz, interval '1 month') gs
        ) t) s)
  ) INTO result;

  RETURN result;
END;
$$;

-- C. Outstanding rent report
CREATE OR REPLACE FUNCTION public.report_outstanding(
  _building_id uuid,
  _from_month date,
  _to_month date,
  _tenant_id uuid DEFAULT NULL,
  _flat_id uuid DEFAULT NULL,
  _status text DEFAULT NULL,
  _include_settled boolean DEFAULT false
)
RETURNS TABLE (
  rent_record_id uuid,
  tenant_name text,
  flat_number text,
  billing_month date,
  due_date date,
  total_billed numeric,
  total_paid numeric,
  remaining_due numeric,
  days_overdue integer,
  payment_status text,
  last_verified_payment timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT rr.id,
         pr.full_name,
         f.flat_number,
         rr.billing_month,
         rr.due_date,
         rr.total_payable,
         rr.total_paid,
         rr.remaining_due,
         GREATEST((current_date - rr.due_date), 0)::integer,
         rr.payment_status::text,
         (SELECT max(p.verified_at) FROM public.rent_payments p
           WHERE p.rent_record_id = rr.id
             AND p.verification_status = 'verified'::public.verification_status)
  FROM public.rent_records rr
  JOIN public.flats f ON f.id = rr.flat_id
  JOIN public.profiles pr ON pr.id = rr.tenant_id
  WHERE public.can_review_building(_building_id, auth.uid())
    AND auth.uid() IS NOT NULL
    AND rr.building_id = _building_id
    AND rr.billing_month >= date_trunc('month', _from_month)::date
    AND rr.billing_month <= date_trunc('month', _to_month)::date
    AND (_tenant_id IS NULL OR rr.tenant_id = _tenant_id)
    AND (_flat_id IS NULL OR rr.flat_id = _flat_id)
    AND (_status IS NULL OR rr.payment_status::text = _status)
    AND (_include_settled OR rr.remaining_due > 0)
  ORDER BY rr.billing_month DESC, f.flat_number
$$;

-- D. Collection report by building/month
CREATE OR REPLACE FUNCTION public.report_collection(_from_month date, _to_month date, _building_id uuid DEFAULT NULL)
RETURNS TABLE (
  building_id uuid,
  building_name text,
  billing_month date,
  total_billed numeric,
  collected numeric,
  outstanding numeric,
  collection_rate numeric,
  fully_paid integer,
  partially_paid integer,
  unpaid integer,
  overdue integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT rr.building_id,
         b.name,
         rr.billing_month,
         sum(rr.total_payable),
         sum(rr.total_paid),
         sum(rr.remaining_due),
         CASE WHEN sum(rr.total_payable) > 0
              THEN round(sum(rr.total_paid) * 100 / sum(rr.total_payable), 2) ELSE 0 END,
         count(*) FILTER (WHERE rr.remaining_due = 0 AND rr.total_paid > 0)::integer,
         count(*) FILTER (WHERE rr.total_paid > 0 AND rr.remaining_due > 0)::integer,
         count(*) FILTER (WHERE rr.total_paid = 0)::integer,
         count(*) FILTER (WHERE rr.remaining_due > 0 AND rr.due_date < current_date)::integer
  FROM public.rent_records rr
  JOIN public.buildings b ON b.id = rr.building_id
  WHERE auth.uid() IS NOT NULL
    AND public.can_review_building(rr.building_id, auth.uid())
    AND (_building_id IS NULL OR rr.building_id = _building_id)
    AND rr.billing_month >= date_trunc('month', _from_month)::date
    AND rr.billing_month <= date_trunc('month', _to_month)::date
  GROUP BY rr.building_id, b.name, rr.billing_month
  ORDER BY rr.billing_month DESC, b.name
$$;

-- E. Expense report
CREATE OR REPLACE FUNCTION public.report_expenses(_from_month date, _to_month date, _building_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  from_month date := date_trunc('month', _from_month)::date;
  to_month date := date_trunc('month', _to_month)::date;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF _building_id IS NOT NULL THEN PERFORM public.report_guard(_building_id); END IF;

  WITH scoped AS (
    SELECT e.*, b.name AS building_name
    FROM public.building_expenses e
    JOIN public.buildings b ON b.id = e.building_id
    WHERE public.can_review_building(e.building_id, auth.uid())
      AND (_building_id IS NULL OR e.building_id = _building_id)
      AND e.accounting_month >= from_month AND e.accounting_month <= to_month
  )
  SELECT jsonb_build_object(
    'from_month', from_month,
    'to_month', to_month,
    'approved_total', coalesce((SELECT sum(amount) FROM scoped WHERE approval_status = 'approved'::public.expense_approval_status), 0),
    'approved_count', (SELECT count(*) FROM scoped WHERE approval_status = 'approved'::public.expense_approval_status),
    'pending_total', coalesce((SELECT sum(amount) FROM scoped WHERE approval_status = 'pending'::public.expense_approval_status), 0),
    'pending_count', (SELECT count(*) FROM scoped WHERE approval_status = 'pending'::public.expense_approval_status),
    'cancelled_total', coalesce((SELECT sum(amount) FROM scoped WHERE approval_status = 'cancelled'::public.expense_approval_status), 0),
    'cancelled_count', (SELECT count(*) FROM scoped WHERE approval_status = 'cancelled'::public.expense_approval_status),
    'rejected_total', coalesce((SELECT sum(amount) FROM scoped WHERE approval_status = 'rejected'::public.expense_approval_status), 0),
    'by_category', coalesce((SELECT jsonb_agg(jsonb_build_object('category', category::text, 'total', total, 'count', cnt) ORDER BY total DESC)
        FROM (SELECT category, sum(amount) AS total, count(*) AS cnt FROM scoped
              WHERE approval_status = 'approved'::public.expense_approval_status GROUP BY category) c), '[]'::jsonb),
    'by_vendor', coalesce((SELECT jsonb_agg(jsonb_build_object('vendor', vendor, 'total', total, 'count', cnt) ORDER BY total DESC)
        FROM (SELECT coalesce(vendor_name, 'Not recorded') AS vendor, sum(amount) AS total, count(*) AS cnt FROM scoped
              WHERE approval_status = 'approved'::public.expense_approval_status GROUP BY 1) v), '[]'::jsonb),
    'by_building', coalesce((SELECT jsonb_agg(jsonb_build_object('building', building_name, 'total', total, 'count', cnt) ORDER BY total DESC)
        FROM (SELECT building_name, sum(amount) AS total, count(*) AS cnt FROM scoped
              WHERE approval_status = 'approved'::public.expense_approval_status GROUP BY 1) g), '[]'::jsonb),
    'trend', coalesce((SELECT jsonb_agg(jsonb_build_object('period', to_char(accounting_month, 'YYYY-MM'), 'total', total) ORDER BY accounting_month)
        FROM (SELECT accounting_month, sum(amount) AS total FROM scoped
              WHERE approval_status = 'approved'::public.expense_approval_status GROUP BY accounting_month) t), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- F. Tenant ledger
CREATE OR REPLACE FUNCTION public.report_tenant_ledger(_tenant_id uuid, _flat_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF _tenant_id <> actor AND NOT public.can_review_tenant(_tenant_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to view this tenant ledger.';
  END IF;

  WITH recs AS (
    SELECT rr.*, f.flat_number, b.name AS building_name
    FROM public.rent_records rr
    JOIN public.flats f ON f.id = rr.flat_id
    JOIN public.buildings b ON b.id = rr.building_id
    WHERE rr.tenant_id = _tenant_id
      AND (_flat_id IS NULL OR rr.flat_id = _flat_id)
  )
  SELECT jsonb_build_object(
    'tenant_id', _tenant_id,
    'tenant_name', (SELECT full_name FROM public.profiles WHERE id = _tenant_id),
    'credit_remaining', coalesce((SELECT sum(tc.remaining_amount) FROM public.tenant_credits tc
        WHERE tc.tenant_id = _tenant_id AND (_flat_id IS NULL OR tc.flat_id = _flat_id)), 0),
    'months', coalesce((SELECT jsonb_agg(m ORDER BY m->>'billing_month') FROM (
      SELECT jsonb_build_object(
        'rent_record_id', r.id,
        'building_name', r.building_name,
        'flat_number', r.flat_number,
        'billing_month', r.billing_month,
        'due_date', r.due_date,
        'base_rent', r.base_rent,
        'total_billed', r.total_payable,
        'total_paid', r.total_paid,
        'remaining_due', r.remaining_due,
        'payment_status', r.payment_status::text,
        'charges', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'type', c.charge_type::text, 'amount', c.amount,
              'provider', c.provider_name, 'description', c.description) ORDER BY c.charge_type)
            FROM public.flat_bill_charges c WHERE c.rent_record_id = r.id), '[]'::jsonb),
        'shared_allocations', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'category', s.category::text, 'amount', a.allocated_amount) ORDER BY s.category)
            FROM public.shared_charge_allocations a
            JOIN public.shared_building_charges s ON s.id = a.shared_charge_id
            WHERE a.rent_record_id = r.id), '[]'::jsonb),
        'adjustments', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'type', j.adjustment_type::text, 'category', j.category::text,
              'amount', j.amount, 'reason', j.reason,
              'posted_month', j.posted_billing_month) ORDER BY j.created_at)
            FROM public.bill_adjustments j WHERE j.rent_record_id = r.id
              AND j.approval_status = 'approved'::public.approval_status), '[]'::jsonb),
        'payments', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'verified_at', p.verified_at, 'amount_paid', p.amount_paid,
              'applied_amount', p.applied_amount, 'credit_amount', p.credit_amount,
              'method', p.payment_method::text, 'receipt_number', p.receipt_number) ORDER BY p.verified_at)
            FROM public.rent_payments p WHERE p.rent_record_id = r.id
              AND p.verification_status = 'verified'::public.verification_status), '[]'::jsonb),
        'audit_payments', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'submitted_at', p.submitted_at, 'amount_paid', p.amount_paid,
              'status', p.verification_status::text, 'method', p.payment_method::text) ORDER BY p.submitted_at)
            FROM public.rent_payments p WHERE p.rent_record_id = r.id
              AND p.verification_status <> 'verified'::public.verification_status), '[]'::jsonb)
      ) AS m
      FROM recs r
    ) x), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Multi-building owner summary (owner-only)
CREATE OR REPLACE FUNCTION public.report_owner_summary(_from_month date, _to_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  from_month date := date_trunc('month', _from_month)::date;
  to_month date := date_trunc('month', _to_month)::date;
  from_ts timestamptz := from_month::timestamptz;
  to_ts timestamptz := (to_month + interval '1 month')::timestamptz;
  result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF NOT public.has_role(actor, 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Only owners can view the multi-building summary.';
  END IF;

  WITH owned AS (
    SELECT b.id, b.name FROM public.buildings b
    WHERE b.owner_id = actor
  ), bills AS (
    SELECT rr.building_id,
           sum(rr.total_payable) AS billed,
           sum(rr.total_paid) AS collected,
           sum(rr.remaining_due) AS outstanding
    FROM public.rent_records rr
    JOIN owned o ON o.id = rr.building_id
    WHERE rr.billing_month >= from_month AND rr.billing_month <= to_month
    GROUP BY rr.building_id
  ), cash AS (
    SELECT p.building_id, sum(p.applied_amount) AS received
    FROM public.rent_payments p
    JOIN owned o ON o.id = p.building_id
    WHERE p.verification_status = 'verified'::public.verification_status
      AND p.verified_at >= from_ts AND p.verified_at < to_ts
    GROUP BY p.building_id
  ), exp AS (
    SELECT e.building_id, sum(e.amount) AS expenses
    FROM public.building_expenses e
    JOIN owned o ON o.id = e.building_id
    WHERE e.approval_status = 'approved'::public.expense_approval_status
      AND e.accounting_month >= from_month AND e.accounting_month <= to_month
    GROUP BY e.building_id
  ), per AS (
    SELECT o.id, o.name,
           coalesce(b.billed, 0) AS billed,
           coalesce(b.collected, 0) AS collected,
           coalesce(b.outstanding, 0) AS outstanding,
           coalesce(c.received, 0) AS received,
           coalesce(x.expenses, 0) AS expenses
    FROM owned o
    LEFT JOIN bills b ON b.building_id = o.id
    LEFT JOIN cash c ON c.building_id = o.id
    LEFT JOIN exp x ON x.building_id = o.id
  )
  SELECT jsonb_build_object(
    'from_month', from_month,
    'to_month', to_month,
    'buildings_count', (SELECT count(*) FROM owned),
    'total_billed', (SELECT coalesce(sum(billed), 0) FROM per),
    'total_collected', (SELECT coalesce(sum(collected), 0) FROM per),
    'total_outstanding', (SELECT coalesce(sum(outstanding), 0) FROM per),
    'approved_expenses', (SELECT coalesce(sum(expenses), 0) FROM per),
    'cash_received', (SELECT coalesce(sum(received), 0) FROM per),
    'net_cash', (SELECT coalesce(sum(received), 0) - coalesce(sum(expenses), 0) FROM per),
    'collection_rate', (SELECT CASE WHEN coalesce(sum(billed), 0) > 0
        THEN round(sum(collected) * 100 / sum(billed), 2) ELSE 0 END FROM per),
    'by_building', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'building_id', id, 'building_name', name, 'billed', billed, 'collected', collected,
        'outstanding', outstanding, 'received', received, 'expenses', expenses,
        'net_cash', received - expenses,
        'collection_rate', CASE WHEN billed > 0 THEN round(collected * 100 / billed, 2) ELSE 0 END)
        ORDER BY name) FROM per), '[]'::jsonb),
    'incomplete_billing_months', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'building_id', t.building_id, 'building_name', t.building_name,
          'billing_month', t.billing_month, 'occupied_flats', t.occupied, 'rent_records', t.records)
        ORDER BY t.billing_month DESC)
      FROM (
        SELECT o.id AS building_id, o.name AS building_name, gs::date AS billing_month,
               (SELECT count(*) FROM public.flats f WHERE f.building_id = o.id
                  AND f.occupancy_status = 'occupied'::public.occupancy_status
                  AND f.tenant_id IS NOT NULL) AS occupied,
               (SELECT count(*) FROM public.rent_records rr WHERE rr.building_id = o.id
                  AND rr.billing_month = gs::date) AS records
        FROM owned o
        CROSS JOIN generate_series(from_month::timestamptz, to_month::timestamptz, interval '1 month') gs
      ) t
      WHERE t.records < t.occupied), '[]'::jsonb),
    'closed_months_with_dues', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'building_id', c.building_id, 'building_name', o.name,
          'billing_month', c.billing_month, 'status', c.status::text,
          'remaining_due', d.due) ORDER BY c.billing_month DESC)
      FROM public.building_month_closures c
      JOIN owned o ON o.id = c.building_id
      JOIN LATERAL (SELECT coalesce(sum(rr.remaining_due), 0) AS due FROM public.rent_records rr
             WHERE rr.building_id = c.building_id AND rr.billing_month = c.billing_month) d ON true
      WHERE c.status = 'closed'::public.month_closure_status
        AND c.billing_month >= from_month AND c.billing_month <= to_month
        AND d.due > 0), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Reconciliation checks (read-only diagnostics)
CREATE OR REPLACE FUNCTION public.report_reconciliation(_building_id uuid, _billing_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m date := date_trunc('month', _billing_month)::date;
  result jsonb;
BEGIN
  PERFORM public.report_guard(_building_id);

  SELECT jsonb_build_object(
    'billing_month', m,
    'record_total_mismatch', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'rent_record_id', rr.id, 'total_billed', rr.total_payable,
        'total_paid', rr.total_paid, 'remaining_due', rr.remaining_due))
      FROM public.rent_records rr
      WHERE rr.building_id = _building_id AND rr.billing_month = m
        AND (rr.total_payable <> GREATEST(rr.base_rent + rr.individual_charges_total
              + rr.shared_charges_total + rr.adjustment_total, 0)
          OR rr.remaining_due <> GREATEST(rr.total_payable - rr.total_paid, 0))), '[]'::jsonb),
    'payment_split_mismatch', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'payment_id', p.id, 'amount_paid', p.amount_paid,
        'applied_amount', p.applied_amount, 'credit_amount', p.credit_amount))
      FROM public.rent_payments p
      JOIN public.rent_records rr ON rr.id = p.rent_record_id
      WHERE p.building_id = _building_id AND rr.billing_month = m
        AND p.verification_status = 'verified'::public.verification_status
        AND p.applied_amount + p.credit_amount <> p.amount_paid), '[]'::jsonb),
    'shared_charge_mismatch', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'shared_charge_id', s.id, 'category', s.category::text,
        'total_amount', s.total_amount, 'allocated_total', a.allocated))
      FROM public.shared_building_charges s
      JOIN LATERAL (SELECT coalesce(sum(al.allocated_amount), 0) AS allocated, count(*) AS n
        FROM public.shared_charge_allocations al WHERE al.shared_charge_id = s.id) a ON true
      WHERE s.building_id = _building_id AND s.billing_month = m
        AND a.n > 0 AND a.allocated <> s.total_amount), '[]'::jsonb),
    'unallocated_shared_charges', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'shared_charge_id', s.id, 'category', s.category::text, 'total_amount', s.total_amount))
      FROM public.shared_building_charges s
      WHERE s.building_id = _building_id AND s.billing_month = m
        AND NOT EXISTS (SELECT 1 FROM public.shared_charge_allocations al
              WHERE al.shared_charge_id = s.id)), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Least-privilege execution grants
REVOKE ALL ON FUNCTION public.report_accessible_buildings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_guard(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_monthly_statement(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_cash_flow(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_outstanding(uuid, date, date, uuid, uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_collection(date, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_expenses(date, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_tenant_ledger(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_owner_summary(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_reconciliation(uuid, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.report_accessible_buildings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_monthly_statement(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_cash_flow(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_outstanding(uuid, date, date, uuid, uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_collection(date, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_expenses(date, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_tenant_ledger(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_owner_summary(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_reconciliation(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_guard(uuid) TO service_role;