
-- ============ ENUMS ============
CREATE TYPE public.notice_priority AS ENUM ('normal','important','urgent','emergency');
CREATE TYPE public.notice_status AS ENUM ('draft','published','archived','cancelled');
CREATE TYPE public.notice_audience_type AS ENUM ('all_tenants','selected_flats','selected_tenants','owner_manager_only');
CREATE TYPE public.notice_action AS ENUM ('created','edited','published','acknowledged','archived','cancelled');
CREATE TYPE public.document_category AS ENUM ('building_rule','tenant_guideline','emergency_contact','rent_policy','maintenance_policy','meeting_minutes','utility_document','legal_document','receipt_or_invoice','other');
CREATE TYPE public.document_visibility AS ENUM ('owner_only','owner_manager','all_building_tenants','selected_flats','selected_tenants');
CREATE TYPE public.notification_type AS ENUM ('notice_published','notice_updated','document_shared','maintenance_update','payment_update','general');

CREATE SEQUENCE public.notice_number_seq;

-- ============ NOTICES ============
CREATE TABLE public.building_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_number text NOT NULL UNIQUE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  priority public.notice_priority NOT NULL DEFAULT 'normal',
  status public.notice_status NOT NULL DEFAULT 'draft',
  audience_type public.notice_audience_type NOT NULL DEFAULT 'all_tenants',
  published_by uuid,
  published_at timestamptz,
  effective_from timestamptz,
  expires_at timestamptz,
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  replaces_notice_id uuid REFERENCES public.building_notices(id) ON DELETE SET NULL,
  replaced_by_notice_id uuid REFERENCES public.building_notices(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  archived_by uuid,
  archived_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.building_notices TO authenticated;
GRANT ALL ON public.building_notices TO service_role;
ALTER TABLE public.building_notices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_building_notices_building ON public.building_notices(building_id, status, published_at DESC);

CREATE TABLE public.notice_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.building_notices(id) ON DELETE CASCADE,
  flat_id uuid REFERENCES public.flats(id) ON DELETE CASCADE,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notice_recipient_target CHECK (flat_id IS NOT NULL OR tenant_id IS NOT NULL)
);
GRANT SELECT ON public.notice_recipients TO authenticated;
GRANT ALL ON public.notice_recipients TO service_role;
ALTER TABLE public.notice_recipients ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_notice_recipient_flat ON public.notice_recipients(notice_id, flat_id) WHERE flat_id IS NOT NULL;
CREATE UNIQUE INDEX idx_notice_recipient_tenant ON public.notice_recipients(notice_id, tenant_id) WHERE tenant_id IS NOT NULL;

CREATE TABLE public.notice_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.building_notices(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, tenant_id)
);
GRANT SELECT ON public.notice_acknowledgements TO authenticated;
GRANT ALL ON public.notice_acknowledgements TO service_role;
ALTER TABLE public.notice_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.building_notices(id) ON DELETE CASCADE,
  action public.notice_action NOT NULL,
  performed_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notice_events TO authenticated;
GRANT ALL ON public.notice_events TO service_role;
ALTER TABLE public.notice_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notice_events_notice ON public.notice_events(notice_id, created_at);

CREATE OR REPLACE FUNCTION public.notice_history_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $$
BEGIN RAISE EXCEPTION 'notice history is append-only'; END; $$;
CREATE TRIGGER notice_events_no_change BEFORE UPDATE OR DELETE ON public.notice_events
FOR EACH ROW EXECUTE FUNCTION public.notice_history_append_only();
CREATE TRIGGER notice_acks_no_change BEFORE UPDATE OR DELETE ON public.notice_acknowledgements
FOR EACH ROW EXECUTE FUNCTION public.notice_history_append_only();

-- ============ DOCUMENTS ============
CREATE TABLE public.building_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category public.document_category NOT NULL DEFAULT 'other',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0),
  visibility public.document_visibility NOT NULL DEFAULT 'owner_manager',
  version_number integer NOT NULL DEFAULT 1,
  replaces_document_id uuid REFERENCES public.building_documents(id) ON DELETE SET NULL,
  replaced_by_document_id uuid REFERENCES public.building_documents(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  archived_by uuid,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.building_documents TO authenticated;
GRANT ALL ON public.building_documents TO service_role;
ALTER TABLE public.building_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_building_documents_building ON public.building_documents(building_id, is_active, created_at DESC);

CREATE TABLE public.document_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.building_documents(id) ON DELETE CASCADE,
  flat_id uuid REFERENCES public.flats(id) ON DELETE CASCADE,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_recipient_target CHECK (flat_id IS NOT NULL OR tenant_id IS NOT NULL)
);
GRANT SELECT ON public.document_recipients TO authenticated;
GRANT ALL ON public.document_recipients TO service_role;
ALTER TABLE public.document_recipients ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_document_recipient_flat ON public.document_recipients(document_id, flat_id) WHERE flat_id IS NOT NULL;
CREATE UNIQUE INDEX idx_document_recipient_tenant ON public.document_recipients(document_id, tenant_id) WHERE tenant_id IS NOT NULL;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type public.notification_type NOT NULL DEFAULT 'general',
  title text NOT NULL,
  message text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_in_app_notifications_user ON public.in_app_notifications(user_id, is_read, created_at DESC);
CREATE UNIQUE INDEX idx_in_app_notifications_dedupe
  ON public.in_app_notifications(user_id, notification_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- ============ VISIBILITY HELPERS ============
CREATE OR REPLACE FUNCTION public.tenant_can_view_notice(_notice_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.building_notices n
    WHERE n.id = _notice_id
      AND _user_id IS NOT NULL
      AND n.status = 'published'::public.notice_status
      AND n.audience_type <> 'owner_manager_only'::public.notice_audience_type
      AND EXISTS (SELECT 1 FROM public.flats f WHERE f.building_id = n.building_id AND f.tenant_id = _user_id)
      AND (
        n.audience_type = 'all_tenants'::public.notice_audience_type
        OR EXISTS (
          SELECT 1 FROM public.notice_recipients r
          WHERE r.notice_id = n.id
            AND (
              r.tenant_id = _user_id
              OR r.flat_id IN (SELECT f2.id FROM public.flats f2 WHERE f2.tenant_id = _user_id)
            )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.tenant_can_view_document(_document_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.building_documents d
    WHERE d.id = _document_id
      AND _user_id IS NOT NULL
      AND d.is_active
      AND d.visibility IN (
        'all_building_tenants'::public.document_visibility,
        'selected_flats'::public.document_visibility,
        'selected_tenants'::public.document_visibility
      )
      AND EXISTS (SELECT 1 FROM public.flats f WHERE f.building_id = d.building_id AND f.tenant_id = _user_id)
      AND (
        d.visibility = 'all_building_tenants'::public.document_visibility
        OR EXISTS (
          SELECT 1 FROM public.document_recipients r
          WHERE r.document_id = d.id
            AND (
              r.tenant_id = _user_id
              OR r.flat_id IN (SELECT f2.id FROM public.flats f2 WHERE f2.tenant_id = _user_id)
            )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_document(_document_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.building_documents d
    WHERE d.id = _document_id
      AND (
        public.is_building_owner(d.building_id, _user_id)
        OR (public.can_review_building(d.building_id, _user_id)
            AND d.visibility <> 'owner_only'::public.document_visibility)
      )
  ) OR public.tenant_can_view_document(_document_id, _user_id)
$$;

-- ============ RLS POLICIES ============
CREATE POLICY "notices visible to staff and targeted tenants" ON public.building_notices
FOR SELECT TO authenticated USING (
  public.can_review_building(building_id, auth.uid())
  OR public.tenant_can_view_notice(id, auth.uid())
);

CREATE POLICY "notice recipients visible to staff" ON public.notice_recipients
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.building_notices n
          WHERE n.id = notice_id AND public.can_review_building(n.building_id, auth.uid()))
);

CREATE POLICY "acknowledgements visible to staff and own tenant" ON public.notice_acknowledgements
FOR SELECT TO authenticated USING (
  tenant_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.building_notices n
             WHERE n.id = notice_id AND public.can_review_building(n.building_id, auth.uid()))
);

CREATE POLICY "notice history visible to staff" ON public.notice_events
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.building_notices n
          WHERE n.id = notice_id AND public.can_review_building(n.building_id, auth.uid()))
);

CREATE POLICY "documents visible per visibility" ON public.building_documents
FOR SELECT TO authenticated USING (
  public.is_building_owner(building_id, auth.uid())
  OR (public.can_review_building(building_id, auth.uid()) AND visibility <> 'owner_only'::public.document_visibility)
  OR public.tenant_can_view_document(id, auth.uid())
);

CREATE POLICY "document recipients visible to staff" ON public.document_recipients
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.building_documents d
          WHERE d.id = document_id AND public.can_review_building(d.building_id, auth.uid()))
);

CREATE POLICY "users read own notifications" ON public.in_app_notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.in_app_notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- storage policies (private bucket, signed URLs only)
CREATE POLICY "building docs read" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'building-documents'
  AND EXISTS (
    SELECT 1 FROM public.building_documents d
    WHERE d.storage_path = storage.objects.name
      AND public.can_view_document(d.id, auth.uid())
  )
);
CREATE POLICY "building docs upload" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'building-documents'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.can_review_building(split_part(name, '/', 1)::uuid, auth.uid())
);

-- ============ INTERNAL NOTIFICATION HELPER ============
CREATE OR REPLACE FUNCTION public.notify_users(
  _user_ids uuid[], _type public.notification_type, _title text, _message text,
  _entity_type text, _entity_id uuid
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  INSERT INTO public.in_app_notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
  SELECT DISTINCT u, _type, _title, _message, _entity_type, _entity_id
  FROM unnest(_user_ids) AS u
  WHERE u IS NOT NULL
  ON CONFLICT DO NOTHING
$$;
REVOKE EXECUTE ON FUNCTION public.notify_users(uuid[], public.notification_type, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notice_audience_user_ids(_notice_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT coalesce(array_agg(DISTINCT t), ARRAY[]::uuid[]) FROM (
    SELECT f.tenant_id AS t
    FROM public.building_notices n
    JOIN public.flats f ON f.building_id = n.building_id
    WHERE n.id = _notice_id
      AND f.tenant_id IS NOT NULL
      AND n.audience_type = 'all_tenants'::public.notice_audience_type
    UNION
    SELECT coalesce(r.tenant_id, f.tenant_id)
    FROM public.notice_recipients r
    JOIN public.building_notices n ON n.id = r.notice_id
    LEFT JOIN public.flats f ON f.id = r.flat_id
    WHERE r.notice_id = _notice_id
      AND n.audience_type IN ('selected_flats'::public.notice_audience_type, 'selected_tenants'::public.notice_audience_type)
  ) s WHERE t IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.notice_audience_user_ids(uuid) FROM PUBLIC, anon;

-- ============ NOTICE RPCs ============
CREATE OR REPLACE FUNCTION public.notice_set_recipients(_notice_id uuid, _flat_ids uuid[], _tenant_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE n public.building_notices; bad integer;
BEGIN
  SELECT * INTO n FROM public.building_notices WHERE id = _notice_id;
  DELETE FROM public.notice_recipients WHERE notice_id = _notice_id;
  IF n.audience_type = 'selected_flats'::public.notice_audience_type THEN
    SELECT count(*) INTO bad FROM unnest(coalesce(_flat_ids, ARRAY[]::uuid[])) fid
      WHERE NOT EXISTS (SELECT 1 FROM public.flats f WHERE f.id = fid AND f.building_id = n.building_id);
    IF bad > 0 THEN RAISE EXCEPTION 'Selected flats must belong to this building.'; END IF;
    IF coalesce(array_length(_flat_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Select at least one flat.'; END IF;
    INSERT INTO public.notice_recipients (notice_id, flat_id)
      SELECT DISTINCT _notice_id, fid FROM unnest(_flat_ids) fid;
  ELSIF n.audience_type = 'selected_tenants'::public.notice_audience_type THEN
    SELECT count(*) INTO bad FROM unnest(coalesce(_tenant_ids, ARRAY[]::uuid[])) tid
      WHERE NOT EXISTS (SELECT 1 FROM public.flats f WHERE f.tenant_id = tid AND f.building_id = n.building_id);
    IF bad > 0 THEN RAISE EXCEPTION 'Selected tenants must live in this building.'; END IF;
    IF coalesce(array_length(_tenant_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Select at least one tenant.'; END IF;
    INSERT INTO public.notice_recipients (notice_id, tenant_id)
      SELECT DISTINCT _notice_id, tid FROM unnest(_tenant_ids) tid;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notice_set_recipients(uuid, uuid[], uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notice_create(
  _building_id uuid, _title text, _content text,
  _priority public.notice_priority DEFAULT 'normal',
  _audience_type public.notice_audience_type DEFAULT 'all_tenants',
  _requires_acknowledgement boolean DEFAULT false,
  _effective_from timestamptz DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _flat_ids uuid[] DEFAULT NULL,
  _tenant_ids uuid[] DEFAULT NULL
) RETURNS public.building_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); n public.building_notices;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF NOT public.can_review_building(_building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to publish notices for this building.';
  END IF;
  IF coalesce(btrim(_title), '') = '' OR coalesce(btrim(_content), '') = '' THEN
    RAISE EXCEPTION 'A title and message are required.';
  END IF;
  IF _expires_at IS NOT NULL AND _effective_from IS NOT NULL AND _expires_at <= _effective_from THEN
    RAISE EXCEPTION 'The expiry time must be after the start time.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.building_notices x
    WHERE x.building_id = _building_id AND x.created_by = actor
      AND lower(btrim(x.title)) = lower(btrim(_title))
      AND x.created_at > now() - interval '1 minute'
  ) THEN
    RAISE EXCEPTION 'You just created this notice. Check the notices list before creating it again.';
  END IF;

  INSERT INTO public.building_notices (
    notice_number, building_id, title, content, priority, audience_type,
    requires_acknowledgement, effective_from, expires_at, created_by
  ) VALUES (
    'NT-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.notice_number_seq')::text, 5, '0'),
    _building_id, btrim(_title), btrim(_content), _priority, _audience_type,
    coalesce(_requires_acknowledgement, false), _effective_from, _expires_at, actor
  ) RETURNING * INTO n;

  PERFORM public.notice_set_recipients(n.id, _flat_ids, _tenant_ids);
  INSERT INTO public.notice_events (notice_id, action, performed_by, note)
    VALUES (n.id, 'created'::public.notice_action, actor, 'Draft created');
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.notice_update_draft(
  _notice_id uuid, _title text, _content text,
  _priority public.notice_priority,
  _audience_type public.notice_audience_type,
  _requires_acknowledgement boolean,
  _effective_from timestamptz DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _flat_ids uuid[] DEFAULT NULL,
  _tenant_ids uuid[] DEFAULT NULL
) RETURNS public.building_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); n public.building_notices;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO n FROM public.building_notices WHERE id = _notice_id FOR UPDATE;
  IF n.id IS NULL THEN RAISE EXCEPTION 'Notice not found.'; END IF;
  IF n.status <> 'draft'::public.notice_status THEN
    RAISE EXCEPTION 'Only a draft notice can be edited. Publish a revised notice instead.';
  END IF;
  IF NOT public.can_review_building(n.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage notices for this building.';
  END IF;
  IF NOT public.is_building_owner(n.building_id, actor) AND n.created_by <> actor THEN
    RAISE EXCEPTION 'You can only edit drafts you created.';
  END IF;

  UPDATE public.building_notices SET
    title = btrim(_title), content = btrim(_content), priority = _priority,
    audience_type = _audience_type, requires_acknowledgement = coalesce(_requires_acknowledgement, false),
    effective_from = _effective_from, expires_at = _expires_at, updated_at = now()
  WHERE id = _notice_id RETURNING * INTO n;

  PERFORM public.notice_set_recipients(n.id, _flat_ids, _tenant_ids);
  INSERT INTO public.notice_events (notice_id, action, performed_by, note)
    VALUES (n.id, 'edited'::public.notice_action, actor, 'Draft updated');
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.notice_publish(_notice_id uuid, _confirmed boolean DEFAULT false)
RETURNS public.building_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); n public.building_notices; recips uuid[];
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_notice_id::text));
  SELECT * INTO n FROM public.building_notices WHERE id = _notice_id FOR UPDATE;
  IF n.id IS NULL THEN RAISE EXCEPTION 'Notice not found.'; END IF;
  IF NOT public.can_review_building(n.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to publish notices for this building.';
  END IF;
  IF n.status = 'published'::public.notice_status THEN
    RAISE EXCEPTION 'This notice is already published.';
  END IF;
  IF n.status <> 'draft'::public.notice_status THEN
    RAISE EXCEPTION 'Only a draft notice can be published.';
  END IF;
  IF n.priority = 'emergency'::public.notice_priority AND coalesce(_confirmed, false) = false THEN
    RAISE EXCEPTION 'Emergency notices need an explicit confirmation before publishing.';
  END IF;

  UPDATE public.building_notices
     SET status = 'published'::public.notice_status, published_by = actor, published_at = now(),
         effective_from = coalesce(effective_from, now()), updated_at = now()
   WHERE id = _notice_id RETURNING * INTO n;

  INSERT INTO public.notice_events (notice_id, action, performed_by, note)
    VALUES (n.id, 'published'::public.notice_action, actor, 'Notice published');

  IF n.audience_type <> 'owner_manager_only'::public.notice_audience_type THEN
    recips := public.notice_audience_user_ids(n.id);
    PERFORM public.notify_users(
      recips, 'notice_published'::public.notification_type,
      CASE WHEN n.priority = 'emergency'::public.notice_priority THEN 'Emergency notice: ' || n.title
           ELSE 'New notice: ' || n.title END,
      'A new building notice has been published. Open Notices & Documents to read it.',
      'building_notice', n.id
    );
  END IF;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.notice_cancel(_notice_id uuid, _reason text)
RETURNS public.building_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); n public.building_notices;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'A cancellation reason is required.'; END IF;
  SELECT * INTO n FROM public.building_notices WHERE id = _notice_id FOR UPDATE;
  IF n.id IS NULL THEN RAISE EXCEPTION 'Notice not found.'; END IF;
  IF NOT public.can_review_building(n.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage notices for this building.';
  END IF;
  IF n.status IN ('cancelled'::public.notice_status, 'archived'::public.notice_status) THEN
    RAISE EXCEPTION 'This notice is no longer active.';
  END IF;
  UPDATE public.building_notices
     SET status = 'cancelled'::public.notice_status, cancellation_reason = btrim(_reason), updated_at = now()
   WHERE id = _notice_id RETURNING * INTO n;
  INSERT INTO public.notice_events (notice_id, action, performed_by, note)
    VALUES (n.id, 'cancelled'::public.notice_action, actor, btrim(_reason));
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.notice_archive(_notice_id uuid, _note text DEFAULT NULL)
RETURNS public.building_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); n public.building_notices;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO n FROM public.building_notices WHERE id = _notice_id FOR UPDATE;
  IF n.id IS NULL THEN RAISE EXCEPTION 'Notice not found.'; END IF;
  IF NOT public.can_review_building(n.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage notices for this building.';
  END IF;
  IF n.status <> 'published'::public.notice_status THEN
    RAISE EXCEPTION 'Only a published notice can be archived.';
  END IF;
  UPDATE public.building_notices
     SET status = 'archived'::public.notice_status, archived_by = actor, archived_at = now(), updated_at = now()
   WHERE id = _notice_id RETURNING * INTO n;
  INSERT INTO public.notice_events (notice_id, action, performed_by, note)
    VALUES (n.id, 'archived'::public.notice_action, actor, NULLIF(btrim(coalesce(_note, '')), ''));
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.notice_acknowledge(_notice_id uuid)
RETURNS public.notice_acknowledgements
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); ack public.notice_acknowledgements;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF NOT public.tenant_can_view_notice(_notice_id, actor) THEN
    RAISE EXCEPTION 'This notice is not addressed to you.';
  END IF;
  SELECT * INTO ack FROM public.notice_acknowledgements WHERE notice_id = _notice_id AND tenant_id = actor;
  IF ack.id IS NOT NULL THEN RETURN ack; END IF;
  INSERT INTO public.notice_acknowledgements (notice_id, tenant_id)
    VALUES (_notice_id, actor)
    ON CONFLICT (notice_id, tenant_id) DO NOTHING
    RETURNING * INTO ack;
  IF ack.id IS NULL THEN
    SELECT * INTO ack FROM public.notice_acknowledgements WHERE notice_id = _notice_id AND tenant_id = actor;
  ELSE
    INSERT INTO public.notice_events (notice_id, action, performed_by, note)
      VALUES (_notice_id, 'acknowledged'::public.notice_action, actor, 'Tenant confirmed reading this notice');
  END IF;
  RETURN ack;
END; $$;

CREATE OR REPLACE FUNCTION public.notice_publish_revision(
  _notice_id uuid, _title text, _content text,
  _priority public.notice_priority,
  _audience_type public.notice_audience_type,
  _requires_acknowledgement boolean,
  _reason text,
  _effective_from timestamptz DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _flat_ids uuid[] DEFAULT NULL,
  _tenant_ids uuid[] DEFAULT NULL,
  _confirmed boolean DEFAULT false
) RETURNS public.building_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); old public.building_notices; fresh public.building_notices;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'A reason for the revision is required.'; END IF;
  SELECT * INTO old FROM public.building_notices WHERE id = _notice_id FOR UPDATE;
  IF old.id IS NULL THEN RAISE EXCEPTION 'Notice not found.'; END IF;
  IF old.status <> 'published'::public.notice_status THEN
    RAISE EXCEPTION 'Only a published notice can be revised.';
  END IF;
  IF NOT public.can_review_building(old.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage notices for this building.';
  END IF;
  IF old.replaced_by_notice_id IS NOT NULL THEN
    RAISE EXCEPTION 'This notice has already been revised.';
  END IF;

  fresh := public.notice_create(
    old.building_id, _title, _content, _priority, _audience_type,
    _requires_acknowledgement, _effective_from, _expires_at, _flat_ids, _tenant_ids
  );
  UPDATE public.building_notices SET replaces_notice_id = old.id WHERE id = fresh.id;
  fresh := public.notice_publish(fresh.id, _confirmed);

  UPDATE public.building_notices
     SET status = 'archived'::public.notice_status, archived_by = actor, archived_at = now(),
         replaced_by_notice_id = fresh.id, updated_at = now()
   WHERE id = old.id;
  INSERT INTO public.notice_events (notice_id, action, performed_by, note)
    VALUES (old.id, 'archived'::public.notice_action, actor, 'Replaced by ' || fresh.notice_number || ': ' || btrim(_reason));

  RETURN fresh;
END; $$;

-- ============ DOCUMENT RPCs ============
CREATE OR REPLACE FUNCTION public.document_set_recipients(_document_id uuid, _flat_ids uuid[], _tenant_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE d public.building_documents; bad integer;
BEGIN
  SELECT * INTO d FROM public.building_documents WHERE id = _document_id;
  DELETE FROM public.document_recipients WHERE document_id = _document_id;
  IF d.visibility = 'selected_flats'::public.document_visibility THEN
    SELECT count(*) INTO bad FROM unnest(coalesce(_flat_ids, ARRAY[]::uuid[])) fid
      WHERE NOT EXISTS (SELECT 1 FROM public.flats f WHERE f.id = fid AND f.building_id = d.building_id);
    IF bad > 0 THEN RAISE EXCEPTION 'Selected flats must belong to this building.'; END IF;
    IF coalesce(array_length(_flat_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Select at least one flat.'; END IF;
    INSERT INTO public.document_recipients (document_id, flat_id)
      SELECT DISTINCT _document_id, fid FROM unnest(_flat_ids) fid;
  ELSIF d.visibility = 'selected_tenants'::public.document_visibility THEN
    SELECT count(*) INTO bad FROM unnest(coalesce(_tenant_ids, ARRAY[]::uuid[])) tid
      WHERE NOT EXISTS (SELECT 1 FROM public.flats f WHERE f.tenant_id = tid AND f.building_id = d.building_id);
    IF bad > 0 THEN RAISE EXCEPTION 'Selected tenants must live in this building.'; END IF;
    IF coalesce(array_length(_tenant_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Select at least one tenant.'; END IF;
    INSERT INTO public.document_recipients (document_id, tenant_id)
      SELECT DISTINCT _document_id, tid FROM unnest(_tenant_ids) tid;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.document_set_recipients(uuid, uuid[], uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.document_create(
  _building_id uuid, _title text, _category public.document_category,
  _storage_path text, _file_name text, _file_type text, _file_size integer,
  _visibility public.document_visibility DEFAULT 'owner_manager',
  _description text DEFAULT NULL,
  _flat_ids uuid[] DEFAULT NULL,
  _tenant_ids uuid[] DEFAULT NULL,
  _replaces_document_id uuid DEFAULT NULL
) RETURNS public.building_documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); d public.building_documents; prev public.building_documents; nextver integer := 1;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF NOT public.can_review_building(_building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to add documents for this building.';
  END IF;
  IF coalesce(btrim(_title), '') = '' THEN RAISE EXCEPTION 'A document title is required.'; END IF;
  IF _file_size IS NULL OR _file_size <= 0 OR _file_size > 20971520 THEN
    RAISE EXCEPTION 'Files must be larger than 0 and at most 20 MB.';
  END IF;
  IF lower(_file_type) NOT IN (
    'application/pdf','image/jpeg','image/jpg','image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) THEN
    RAISE EXCEPTION 'Only PDF, JPG, PNG or DOCX files can be uploaded.';
  END IF;
  IF _visibility = 'owner_only'::public.document_visibility AND NOT public.is_building_owner(_building_id, actor) THEN
    RAISE EXCEPTION 'Only the building owner can add an owner-only document.';
  END IF;

  IF _replaces_document_id IS NOT NULL THEN
    SELECT * INTO prev FROM public.building_documents WHERE id = _replaces_document_id FOR UPDATE;
    IF prev.id IS NULL OR prev.building_id <> _building_id THEN
      RAISE EXCEPTION 'The document being replaced was not found in this building.';
    END IF;
    IF prev.replaced_by_document_id IS NOT NULL THEN
      RAISE EXCEPTION 'That document has already been replaced by a newer version.';
    END IF;
    nextver := prev.version_number + 1;
  END IF;

  INSERT INTO public.building_documents (
    building_id, title, description, category, storage_path, file_name, file_type, file_size,
    visibility, version_number, replaces_document_id, uploaded_by
  ) VALUES (
    _building_id, btrim(_title), NULLIF(btrim(coalesce(_description, '')), ''), _category,
    _storage_path, _file_name, lower(_file_type), _file_size, _visibility, nextver,
    _replaces_document_id, actor
  ) RETURNING * INTO d;

  PERFORM public.document_set_recipients(d.id, _flat_ids, _tenant_ids);

  IF prev.id IS NOT NULL THEN
    UPDATE public.building_documents
       SET is_active = false, replaced_by_document_id = d.id, updated_at = now()
     WHERE id = prev.id;
  END IF;

  IF d.visibility IN ('all_building_tenants'::public.document_visibility,
                      'selected_flats'::public.document_visibility,
                      'selected_tenants'::public.document_visibility) THEN
    PERFORM public.notify_users(
      (SELECT coalesce(array_agg(DISTINCT t), ARRAY[]::uuid[]) FROM (
        SELECT f.tenant_id AS t FROM public.flats f
         WHERE f.building_id = d.building_id AND f.tenant_id IS NOT NULL
           AND d.visibility = 'all_building_tenants'::public.document_visibility
        UNION
        SELECT coalesce(r.tenant_id, f2.tenant_id)
          FROM public.document_recipients r
          LEFT JOIN public.flats f2 ON f2.id = r.flat_id
         WHERE r.document_id = d.id
      ) s WHERE t IS NOT NULL),
      'document_shared'::public.notification_type,
      'New document: ' || d.title,
      'A building document has been shared with you. Open Notices & Documents to view it.',
      'building_document', d.id
    );
  END IF;

  RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.document_archive(_document_id uuid, _reason text)
RETURNS public.building_documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); d public.building_documents;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'An archive reason is required.'; END IF;
  SELECT * INTO d FROM public.building_documents WHERE id = _document_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF NOT public.can_review_building(d.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage documents for this building.';
  END IF;
  IF NOT d.is_active THEN RAISE EXCEPTION 'This document is already archived.'; END IF;
  UPDATE public.building_documents
     SET is_active = false, archived_by = actor, archived_at = now(),
         archive_reason = btrim(_reason), updated_at = now()
   WHERE id = _document_id RETURNING * INTO d;
  RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.notifications_mark_read(_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE actor uuid := auth.uid(); n integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  UPDATE public.in_app_notifications
     SET is_read = true, read_at = now()
   WHERE user_id = actor AND is_read = false
     AND (_ids IS NULL OR id = ANY(_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

-- updated_at triggers
CREATE TRIGGER building_notices_updated_at BEFORE UPDATE ON public.building_notices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER building_documents_updated_at BEFORE UPDATE ON public.building_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GRANTS ON RPCs ============
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.notice_create(uuid,text,text,public.notice_priority,public.notice_audience_type,boolean,timestamptz,timestamptz,uuid[],uuid[])',
    'public.notice_update_draft(uuid,text,text,public.notice_priority,public.notice_audience_type,boolean,timestamptz,timestamptz,uuid[],uuid[])',
    'public.notice_publish(uuid,boolean)',
    'public.notice_cancel(uuid,text)',
    'public.notice_archive(uuid,text)',
    'public.notice_acknowledge(uuid)',
    'public.notice_publish_revision(uuid,text,text,public.notice_priority,public.notice_audience_type,boolean,text,timestamptz,timestamptz,uuid[],uuid[],boolean)',
    'public.document_create(uuid,text,public.document_category,text,text,text,integer,public.document_visibility,text,uuid[],uuid[],uuid)',
    'public.document_archive(uuid,text)',
    'public.notifications_mark_read(uuid[])',
    'public.tenant_can_view_notice(uuid,uuid)',
    'public.tenant_can_view_document(uuid,uuid)',
    'public.can_view_document(uuid,uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;
