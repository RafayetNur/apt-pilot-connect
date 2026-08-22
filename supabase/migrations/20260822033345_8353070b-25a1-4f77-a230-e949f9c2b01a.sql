DO $$
DECLARE
  r record;
  allowed text[] := ARRAY[
    'allocate_shared_charge','cancel_building_expense','close_building_month',
    'create_expense_draft_from_work_order','create_maintenance_request','document_archive',
    'document_create','maintenance_assign','maintenance_change_status','maintenance_set_priority',
    'maintenance_tenant_schedule','notice_acknowledge','notice_archive','notice_cancel',
    'notice_create','notice_publish','notice_publish_revision','notice_update_draft',
    'reopen_building_month','report_accessible_buildings','report_cash_flow','report_collection',
    'report_expenses','report_monthly_statement','report_outstanding','report_owner_summary',
    'report_reconciliation','report_tenant_ledger','review_bill_adjustment','review_building_expense',
    'review_rent_payment','withdraw_rent_payment','work_order_create','work_order_update_status',
    'notifications_mark_read','assign_user_role',
    -- RLS helpers referenced by policy expressions (must stay executable)
    'can_manage_maintenance_request','can_review_building','can_view_building','can_view_document',
    'can_view_maintenance_request','has_role','is_building_owner','tenant_can_view_document',
    'tenant_can_view_notice'
  ];
BEGIN
  FOR r IN
    SELECT p.proname, p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_get_function_result(p.oid) <> 'trigger'
      AND NOT (p.proname = ANY(allowed))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
