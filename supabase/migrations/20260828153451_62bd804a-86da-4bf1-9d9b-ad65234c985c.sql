ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'sslcommerz';

CREATE TYPE public.gateway_txn_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'review_required');

CREATE TABLE public.sslcommerz_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tran_id text NOT NULL UNIQUE,
  rent_record_id uuid NOT NULL REFERENCES public.rent_records(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  expected_amount numeric NOT NULL CHECK (expected_amount > 0),
  currency text NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  status public.gateway_txn_status NOT NULL DEFAULT 'pending',
  sessionkey text,
  val_id text,
  bank_tran_id text,
  validated_amount numeric,
  risk_level text,
  failure_reason text,
  rent_payment_id uuid REFERENCES public.rent_payments(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sslcommerz_transactions_val_id_key
  ON public.sslcommerz_transactions (val_id) WHERE val_id IS NOT NULL;
CREATE INDEX sslcommerz_transactions_tenant_idx ON public.sslcommerz_transactions (tenant_id);
CREATE INDEX sslcommerz_transactions_record_idx ON public.sslcommerz_transactions (rent_record_id);

GRANT SELECT ON public.sslcommerz_transactions TO authenticated;
GRANT ALL ON public.sslcommerz_transactions TO service_role;

ALTER TABLE public.sslcommerz_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants read their own gateway transactions"
  ON public.sslcommerz_transactions FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Reviewers read gateway transactions for their buildings"
  ON public.sslcommerz_transactions FOR SELECT TO authenticated
  USING (app_private.can_review_building(building_id, auth.uid()));

CREATE TRIGGER sslcommerz_transactions_set_updated_at
  BEFORE UPDATE ON public.sslcommerz_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.finalize_sslcommerz_payment(
  _tran_id text,
  _val_id text,
  _bank_tran_id text,
  _validated_amount numeric,
  _currency text,
  _risky boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  txn public.sslcommerz_transactions;
  rec public.rent_records;
  remaining numeric;
  applied numeric;
  excess numeric;
  new_total numeric;
  new_remaining numeric;
  new_status public.payment_status;
  pay public.rent_payments;
BEGIN
  SELECT * INTO txn FROM public.sslcommerz_transactions
    WHERE tran_id = _tran_id FOR UPDATE;
  IF txn.id IS NULL THEN
    RETURN 'unknown';
  END IF;

  -- Idempotency: already finalized callbacks are a no-op.
  IF txn.status <> 'pending' THEN
    RETURN txn.status::text;
  END IF;

  IF coalesce(_currency, 'BDT') <> txn.currency
     OR _validated_amount IS NULL
     OR _validated_amount < txn.expected_amount THEN
    UPDATE public.sslcommerz_transactions
      SET status = 'review_required', val_id = _val_id, bank_tran_id = _bank_tran_id,
          validated_amount = _validated_amount,
          failure_reason = 'amount_or_currency_mismatch', finalized_at = now()
      WHERE id = txn.id;
    RETURN 'review_required';
  END IF;

  IF _risky THEN
    UPDATE public.sslcommerz_transactions
      SET status = 'review_required', val_id = _val_id, bank_tran_id = _bank_tran_id,
          validated_amount = _validated_amount,
          failure_reason = 'risk_flagged', finalized_at = now()
      WHERE id = txn.id;
    RETURN 'review_required';
  END IF;

  SELECT * INTO rec FROM public.rent_records WHERE id = txn.rent_record_id FOR UPDATE;
  IF rec.id IS NULL THEN
    UPDATE public.sslcommerz_transactions
      SET status = 'review_required', val_id = _val_id, bank_tran_id = _bank_tran_id,
          validated_amount = _validated_amount,
          failure_reason = 'rent_record_missing', finalized_at = now()
      WHERE id = txn.id;
    RETURN 'review_required';
  END IF;

  remaining := GREATEST(rec.total_payable - GREATEST(rec.total_paid, 0), 0);
  applied := LEAST(_validated_amount, remaining);
  excess := _validated_amount - applied;
  new_total := GREATEST(rec.total_paid, 0) + applied;
  new_remaining := GREATEST(rec.total_payable - new_total, 0);

  IF new_remaining = 0 AND new_total > 0 THEN
    new_status := 'paid'::public.payment_status;
  ELSIF new_total > 0 THEN
    new_status := 'partially_paid'::public.payment_status;
  ELSE
    new_status := rec.payment_status;
  END IF;

  INSERT INTO public.rent_payments (
    rent_record_id, building_id, flat_id, tenant_id, amount_paid, payment_method,
    provider_name, transaction_reference, verification_status, verified_at,
    applied_amount, credit_amount, receipt_number
  ) VALUES (
    txn.rent_record_id, txn.building_id, txn.flat_id, txn.tenant_id,
    _validated_amount, 'sslcommerz'::public.payment_method,
    'SSLCOMMERZ', coalesce(nullif(btrim(_bank_tran_id), ''), _tran_id),
    'verified'::public.verification_status, now(),
    applied, excess,
    'APT-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad(nextval('public.receipt_number_seq')::text, 5, '0')
  ) RETURNING * INTO pay;

  UPDATE public.rent_records
    SET total_paid = new_total, remaining_due = new_remaining, payment_status = new_status
    WHERE id = rec.id;

  IF excess > 0 THEN
    INSERT INTO public.tenant_credits (
      tenant_id, building_id, flat_id, amount, source_payment_id, remaining_amount
    ) VALUES (pay.tenant_id, pay.building_id, pay.flat_id, excess, pay.id, excess);
  END IF;

  UPDATE public.sslcommerz_transactions
    SET status = 'paid', val_id = _val_id, bank_tran_id = _bank_tran_id,
        validated_amount = _validated_amount, rent_payment_id = pay.id,
        finalized_at = now()
    WHERE id = txn.id;

  RETURN 'paid';
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_sslcommerz_payment(text, text, text, numeric, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_sslcommerz_payment(text, text, text, numeric, text, boolean) TO service_role;