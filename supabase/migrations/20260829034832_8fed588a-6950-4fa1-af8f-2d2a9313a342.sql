ALTER TABLE public.sslcommerz_transactions
  ADD COLUMN IF NOT EXISTS gateway_hostname text
  CHECK (gateway_hostname IS NULL OR (char_length(gateway_hostname) <= 253 AND gateway_hostname = lower(gateway_hostname)));