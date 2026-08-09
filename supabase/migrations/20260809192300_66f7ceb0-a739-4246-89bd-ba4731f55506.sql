-- ============ ENUMS ============
CREATE TYPE public.expense_category AS ENUM (
  'electricity_common','generator_fuel','water','gas','internet','security_guard',
  'cleaner','caretaker','maintenance','repair','lift','supplies','tax','insurance',
  'management','other'
);

CREATE TYPE public.expense_payment_method AS ENUM (
  'cash','bkash','nagad','bank_transfer','cheque','other'
);

CREATE TYPE public.expense_approval_status AS ENUM (
  'pending','approved','rejected','cancelled'
);

-- ============ TABLE ============
CREATE TABLE public.building_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  expense_date date NOT NULL,
  accounting_month date NOT NULL,
  related_month date,
  category public.expense_category NOT NULL,
  description text NOT NULL,
  vendor_name text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method public.expense_payment_method NOT NULL,
  transaction_reference text,
  receipt_document_url text,
  approval_status public.expense_approval_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  reviewer_note text,
  cancelled_by uuid REFERENCES public.profiles(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  replaces_expense_id uuid REFERENCES public.building_expenses(id),
  replaced_by_expense_id uuid REFERENCES public.building_expenses(id),
  source_shared_charge_id uuid REFERENCES public.shared_building_charges(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT building_expenses_description_not_blank CHECK (btrim(description) <> ''),
  CONSTRAINT building_expenses_month_normalized CHECK (accounting_month = date_trunc('month', accounting_month)::date),
  CONSTRAINT building_expenses_related_month_normalized CHECK (related_month IS NULL OR related_month = date_trunc('month', related_month)::date)
);

CREATE INDEX building_expenses_building_idx ON public.building_expenses (building_id);
CREATE INDEX building_expenses_month_idx ON public.building_expenses (accounting_month);
CREATE INDEX building_expenses_date_idx ON public.building_expenses (expense_date);
CREATE INDEX building_expenses_status_idx ON public.building_expenses (approval_status);
CREATE INDEX building_expenses_category_idx ON public.building_expenses (category);

GRANT SELECT, INSERT, UPDATE ON public.building_expenses TO authenticated;
GRANT ALL ON public.building_expenses TO service_role;

ALTER TABLE public.building_expenses ENABLE ROW LEVEL SECURITY;

-- Viewing: owner of the building, or assigned manager (never tenants/anon)
CREATE POLICY "Owners and managers view building expenses"
ON public.building_expenses FOR SELECT TO authenticated
USING (public.can_review_building(building_id, auth.uid()));

-- Creating: must be self-attributed; managers can only create pending rows,
-- owners may record their own entries as already approved (final authority).
CREATE POLICY "Owners and managers create building expenses"
ON public.building_expenses FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL
  AND replaced_by_expense_id IS NULL
  AND (
    (
      public.is_building_owner(building_id, auth.uid())
      AND (
        (approval_status = 'pending'::public.expense_approval_status
          AND approved_by IS NULL AND approved_at IS NULL)
        OR (approval_status = 'approved'::public.expense_approval_status
          AND approved_by = auth.uid())
      )
    )
    OR (
      NOT public.is_building_owner(building_id, auth.uid())
      AND public.can_review_building(building_id, auth.uid())
      AND approval_status = 'pending'::public.expense_approval_status
      AND approved_by IS NULL AND approved_at IS NULL
    )
  )
);

-- Editing: only the creator, only while still pending. Status/approval/cancellation
-- transitions happen through the guarded RPCs below (security definer).
CREATE POLICY "Creators edit own pending expenses"
ON public.building_expenses FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  AND approval_status = 'pending'::public.expense_approval_status
  AND public.can_review_building(building_id, auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  AND approval_status = 'pending'::public.expense_approval_status
  AND approved_by IS NULL AND approved_at IS NULL
  AND cancelled_by IS NULL AND cancelled_at IS NULL
  AND public.can_review_building(building_id, auth.uid())
);

-- No DELETE policy: expense history is never physically removed.

-- ============ TRIGGERS ============
CREATE TRIGGER building_expenses_updated_at
BEFORE UPDATE ON public.building_expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.building_expenses_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.accounting_month := date_trunc('month', NEW.accounting_month)::date;
  IF NEW.related_month IS NOT NULL THEN
    NEW.related_month := date_trunc('month', NEW.related_month)::date;
  END IF;
  NEW.description := btrim(NEW.description);
  NEW.vendor_name := NULLIF(btrim(coalesce(NEW.vendor_name, '')), '');
  NEW.transaction_reference := NULLIF(btrim(coalesce(NEW.transaction_reference, '')), '');
  RETURN NEW;
END;
$$;

CREATE TRIGGER building_expenses_normalize
BEFORE INSERT OR UPDATE ON public.building_expenses
FOR EACH ROW EXECUTE FUNCTION public.building_expenses_normalize();

-- Closed accounting months are locked for expense entry/editing.
CREATE OR REPLACE FUNCTION public.guard_closed_month_expenses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_month_closed(NEW.building_id, NEW.accounting_month) THEN
    RAISE EXCEPTION 'month_closed: post this expense to the next open accounting month instead.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_closed_month_expenses
BEFORE INSERT OR UPDATE ON public.building_expenses
FOR EACH ROW EXECUTE FUNCTION public.guard_closed_month_expenses();

-- Approved accounting values are immutable outside the RPCs.
CREATE OR REPLACE FUNCTION public.building_expenses_protect_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.approval_status <> 'pending'::public.expense_approval_status THEN
    IF NEW.building_id IS DISTINCT FROM OLD.building_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.accounting_month IS DISTINCT FROM OLD.accounting_month
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.transaction_reference IS DISTINCT FROM OLD.transaction_reference
       OR NEW.expense_date IS DISTINCT FROM OLD.expense_date
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'expense_locked: cancel this expense and record a corrected replacement instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER building_expenses_protect_approved
BEFORE UPDATE ON public.building_expenses
FOR EACH ROW EXECUTE FUNCTION public.building_expenses_protect_approved();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.review_building_expense(
  _expense_id uuid, _action text, _note text DEFAULT NULL
)
RETURNS public.building_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  exp public.building_expenses;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;

  SELECT * INTO exp FROM public.building_expenses WHERE id = _expense_id FOR UPDATE;
  IF exp.id IS NULL THEN RAISE EXCEPTION 'Expense not found.'; END IF;

  IF NOT public.is_building_owner(exp.building_id, actor) THEN
    RAISE EXCEPTION 'Only the building owner can approve or reject an expense.';
  END IF;

  IF exp.approval_status <> 'pending'::public.expense_approval_status THEN
    RAISE EXCEPTION 'This expense has already been reviewed.';
  END IF;

  IF _action = 'reject' THEN
    IF coalesce(btrim(_note), '') = '' THEN
      RAISE EXCEPTION 'A reviewer note is required when rejecting an expense.';
    END IF;
    UPDATE public.building_expenses
       SET approval_status = 'rejected'::public.expense_approval_status,
           reviewer_note = btrim(_note), approved_by = actor, approved_at = now()
     WHERE id = _expense_id RETURNING * INTO exp;
    RETURN exp;
  ELSIF _action <> 'approve' THEN
    RAISE EXCEPTION 'Unknown review action.';
  END IF;

  UPDATE public.building_expenses
     SET approval_status = 'approved'::public.expense_approval_status,
         reviewer_note = NULLIF(btrim(coalesce(_note, '')), ''),
         approved_by = actor, approved_at = now()
   WHERE id = _expense_id RETURNING * INTO exp;

  RETURN exp;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_building_expense(
  _expense_id uuid, _reason text, _replacement_expense_id uuid DEFAULT NULL
)
RETURNS public.building_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  exp public.building_expenses;
  repl public.building_expenses;
  actor uuid := auth.uid();
  is_owner boolean;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'A cancellation reason is required.';
  END IF;

  SELECT * INTO exp FROM public.building_expenses WHERE id = _expense_id FOR UPDATE;
  IF exp.id IS NULL THEN RAISE EXCEPTION 'Expense not found.'; END IF;

  is_owner := public.is_building_owner(exp.building_id, actor);

  IF exp.approval_status = 'approved'::public.expense_approval_status THEN
    IF NOT is_owner THEN
      RAISE EXCEPTION 'Only the building owner can cancel an approved expense.';
    END IF;
  ELSIF exp.approval_status = 'pending'::public.expense_approval_status THEN
    IF NOT is_owner AND exp.created_by <> actor THEN
      RAISE EXCEPTION 'You can only cancel your own pending expense.';
    END IF;
    IF NOT public.can_review_building(exp.building_id, actor) THEN
      RAISE EXCEPTION 'You are not allowed to manage expenses for this building.';
    END IF;
  ELSE
    RAISE EXCEPTION 'This expense can no longer be cancelled.';
  END IF;

  IF _replacement_expense_id IS NOT NULL THEN
    SELECT * INTO repl FROM public.building_expenses WHERE id = _replacement_expense_id FOR UPDATE;
    IF repl.id IS NULL OR repl.building_id <> exp.building_id THEN
      RAISE EXCEPTION 'Replacement expense not found for this building.';
    END IF;
    UPDATE public.building_expenses SET replaces_expense_id = exp.id
     WHERE id = repl.id;
  END IF;

  UPDATE public.building_expenses
     SET approval_status = 'cancelled'::public.expense_approval_status,
         cancelled_by = actor, cancelled_at = now(),
         cancellation_reason = btrim(_reason),
         replaced_by_expense_id = coalesce(_replacement_expense_id, replaced_by_expense_id)
   WHERE id = _expense_id RETURNING * INTO exp;

  RETURN exp;
END;
$$;

REVOKE ALL ON FUNCTION public.review_building_expense(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_building_expense(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.building_expenses_normalize() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_closed_month_expenses() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.building_expenses_protect_approved() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_building_expense(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_building_expense(uuid, text, uuid) TO authenticated, service_role;

-- ============ STORAGE POLICIES (bucket created separately) ============
CREATE POLICY "Owners and managers read expense receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND public.can_review_building(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Owners and managers upload expense receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND public.can_review_building(((storage.foldername(name))[1])::uuid, auth.uid())
);
