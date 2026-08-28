-- 1. Financial audit retention: stop gateway history from being silently erased.
ALTER TABLE public.sslcommerz_transactions
  DROP CONSTRAINT sslcommerz_transactions_rent_record_id_fkey,
  ADD CONSTRAINT sslcommerz_transactions_rent_record_id_fkey
    FOREIGN KEY (rent_record_id) REFERENCES public.rent_records(id) ON DELETE RESTRICT,
  DROP CONSTRAINT sslcommerz_transactions_tenant_id_fkey,
  ADD CONSTRAINT sslcommerz_transactions_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  DROP CONSTRAINT sslcommerz_transactions_building_id_fkey,
  ADD CONSTRAINT sslcommerz_transactions_building_id_fkey
    FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE RESTRICT,
  DROP CONSTRAINT sslcommerz_transactions_flat_id_fkey,
  ADD CONSTRAINT sslcommerz_transactions_flat_id_fkey
    FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE RESTRICT,
  DROP CONSTRAINT sslcommerz_transactions_rent_payment_id_fkey,
  ADD CONSTRAINT sslcommerz_transactions_rent_payment_id_fkey
    FOREIGN KEY (rent_payment_id) REFERENCES public.rent_payments(id) ON DELETE RESTRICT;

-- 2. Exact-amount finalization, redirect/IPN race safety, idempotency.
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
  gross numeric;
  expected numeric;
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

  -- Terminal states are never re-processed or downgraded. A 'failed' or
  -- 'cancelled' row only ever came from an informational browser redirect,
  -- so a late server-validated IPN is still allowed to settle it.
  IF txn.status IN ('paid', 'review_required') OR txn.rent_payment_id IS NOT NULL THEN
    RETURN txn.status::text;
  END IF;

  gross := round(coalesce(_validated_amount, -1), 2);
  expected := round(txn.expected_amount, 2);

  -- Exact gross-amount match only. Under- and overpayment both go to review
  -- with zero financial effect.
  IF coalesce(_currency, '') <> txn.currency
     OR _validated_amount IS NULL
     OR gross <> expected THEN
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

  -- A legitimate manual payment may have landed while the customer was on the
  -- gateway page; the surplus becomes tenant credit exactly as before.
  remaining := GREATEST(rec.total_payable - GREATEST(rec.total_paid, 0), 0);
  applied := LEAST(gross, remaining);
  excess := gross - applied;
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
    gross, 'sslcommerz'::public.payment_method,
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
        validated_amount = gross, rent_payment_id = pay.id,
        finalized_at = now()
    WHERE id = txn.id;

  RETURN 'paid';
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_sslcommerz_payment(text, text, text, numeric, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_sslcommerz_payment(text, text, text, numeric, text, boolean) TO service_role;