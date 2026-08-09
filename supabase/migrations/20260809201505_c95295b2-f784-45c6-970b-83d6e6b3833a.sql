-- ============ ENUMS ============
CREATE TYPE public.maintenance_category AS ENUM (
  'plumbing','electrical','gas','water','appliance','structural','lift',
  'security','cleanliness','common_area','internet','pest_control','other'
);
CREATE TYPE public.maintenance_priority AS ENUM ('low','medium','high','emergency');
CREATE TYPE public.maintenance_status AS ENUM (
  'submitted','acknowledged','assigned','in_progress','waiting_for_parts',
  'resolved','closed','rejected','cancelled','reopened'
);
CREATE TYPE public.work_order_status AS ENUM ('draft','assigned','in_progress','completed','cancelled');
CREATE TYPE public.maintenance_attachment_type AS ENUM ('issue_photo','issue_video','document','completion_proof');
CREATE TYPE public.maintenance_comment_visibility AS ENUM ('shared','internal');

CREATE SEQUENCE public.maintenance_request_number_seq;
CREATE SEQUENCE public.work_order_number_seq;

-- ============ TABLES ============
CREATE TABLE public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  building_id uuid NOT NULL REFERENCES public.buildings(id),
  flat_id uuid REFERENCES public.flats(id),
  tenant_id uuid REFERENCES public.profiles(id),
  submitted_by uuid NOT NULL REFERENCES public.profiles(id),
  category public.maintenance_category NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority public.maintenance_priority NOT NULL DEFAULT 'medium',
  status public.maintenance_status NOT NULL DEFAULT 'submitted',
  preferred_visit_date date,
  access_instructions text,
  is_common_area boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES public.profiles(id),
  acknowledged_at timestamptz,
  assigned_to uuid REFERENCES public.profiles(id),
  assigned_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  resolution_note text,
  closed_by uuid REFERENCES public.profiles(id),
  closed_at timestamptz,
  rejection_reason text,
  cancellation_reason text,
  reopened_by uuid REFERENCES public.profiles(id),
  reopened_at timestamptz,
  reopening_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_requests_title_len CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  CONSTRAINT maintenance_requests_desc_len CHECK (char_length(btrim(description)) BETWEEN 5 AND 4000),
  CONSTRAINT maintenance_requests_flat_scope CHECK (is_common_area = true OR flat_id IS NOT NULL)
);

CREATE TABLE public.maintenance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id uuid NOT NULL REFERENCES public.maintenance_requests(id),
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 26214400),
  attachment_type public.maintenance_attachment_type NOT NULL DEFAULT 'issue_photo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id uuid NOT NULL REFERENCES public.maintenance_requests(id),
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  comment_text text NOT NULL CHECK (char_length(btrim(comment_text)) BETWEEN 1 AND 2000),
  visibility public.maintenance_comment_visibility NOT NULL DEFAULT 'shared',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number text NOT NULL UNIQUE,
  maintenance_request_id uuid NOT NULL REFERENCES public.maintenance_requests(id),
  building_id uuid NOT NULL REFERENCES public.buildings(id),
  assigned_manager_id uuid REFERENCES public.profiles(id),
  vendor_name text,
  vendor_phone text,
  technician_name text,
  scheduled_date date,
  scheduled_time text,
  estimated_cost numeric(12,2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  actual_cost numeric(12,2) CHECK (actual_cost IS NULL OR actual_cost >= 0),
  status public.work_order_status NOT NULL DEFAULT 'draft',
  work_description text NOT NULL CHECK (char_length(btrim(work_description)) BETWEEN 3 AND 4000),
  completion_note text,
  completed_by uuid REFERENCES public.profiles(id),
  completed_at timestamptz,
  cancellation_reason text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id uuid NOT NULL REFERENCES public.maintenance_requests(id),
  previous_status public.maintenance_status,
  new_status public.maintenance_status NOT NULL,
  performed_by uuid NOT NULL REFERENCES public.profiles(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.work_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  previous_status public.work_order_status,
  new_status public.work_order_status NOT NULL,
  performed_by uuid NOT NULL REFERENCES public.profiles(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.building_expenses
  ADD COLUMN source_work_order_id uuid REFERENCES public.work_orders(id);

-- ============ INDEXES ============
CREATE INDEX idx_mr_building ON public.maintenance_requests(building_id, status);
CREATE INDEX idx_mr_flat ON public.maintenance_requests(flat_id);
CREATE INDEX idx_mr_tenant ON public.maintenance_requests(tenant_id);
CREATE INDEX idx_mr_submitted_by ON public.maintenance_requests(submitted_by);
CREATE INDEX idx_mr_assigned_to ON public.maintenance_requests(assigned_to);
CREATE INDEX idx_mr_priority ON public.maintenance_requests(priority, status);
CREATE INDEX idx_mr_category ON public.maintenance_requests(category);
CREATE INDEX idx_mr_created ON public.maintenance_requests(created_at DESC);
CREATE INDEX idx_ma_request ON public.maintenance_attachments(maintenance_request_id);
CREATE INDEX idx_mc_request ON public.maintenance_comments(maintenance_request_id, created_at);
CREATE INDEX idx_wo_request ON public.work_orders(maintenance_request_id);
CREATE INDEX idx_wo_building ON public.work_orders(building_id, status);
CREATE INDEX idx_wo_manager ON public.work_orders(assigned_manager_id);
CREATE INDEX idx_wo_scheduled ON public.work_orders(scheduled_date);
CREATE INDEX idx_mse_request ON public.maintenance_status_events(maintenance_request_id, created_at);
CREATE INDEX idx_woe_order ON public.work_order_events(work_order_id, created_at);
CREATE UNIQUE INDEX idx_expense_one_per_work_order
  ON public.building_expenses(source_work_order_id)
  WHERE source_work_order_id IS NOT NULL
    AND approval_status <> 'cancelled'::public.expense_approval_status;

-- ============ GRANTS ============
GRANT SELECT ON public.maintenance_requests TO authenticated;
GRANT SELECT, INSERT ON public.maintenance_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.maintenance_comments TO authenticated;
GRANT SELECT ON public.work_orders TO authenticated;
GRANT SELECT ON public.maintenance_status_events TO authenticated;
GRANT SELECT ON public.work_order_events TO authenticated;
GRANT ALL ON public.maintenance_requests TO service_role;
GRANT ALL ON public.maintenance_attachments TO service_role;
GRANT ALL ON public.maintenance_comments TO service_role;
GRANT ALL ON public.work_orders TO service_role;
GRANT ALL ON public.maintenance_status_events TO service_role;
GRANT ALL ON public.work_order_events TO service_role;
GRANT USAGE ON SEQUENCE public.maintenance_request_number_seq TO service_role;
GRANT USAGE ON SEQUENCE public.work_order_number_seq TO service_role;

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_events ENABLE ROW LEVEL SECURITY;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.can_view_maintenance_request(_request_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.maintenance_requests r
    WHERE r.id = _request_id
      AND (
        r.submitted_by = _user_id
        OR r.tenant_id = _user_id
        OR public.can_review_building(r.building_id, _user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_maintenance_request(_request_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.maintenance_requests r
    WHERE r.id = _request_id AND public.can_review_building(r.building_id, _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.maintenance_transition_allowed(
  _from public.maintenance_status, _to public.maintenance_status
) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT (_from, _to) IN (
    ('submitted','acknowledged'),('submitted','rejected'),('submitted','cancelled'),
    ('acknowledged','assigned'),('acknowledged','rejected'),('acknowledged','cancelled'),
    ('assigned','in_progress'),
    ('in_progress','waiting_for_parts'),('in_progress','resolved'),
    ('waiting_for_parts','in_progress'),
    ('resolved','closed'),('resolved','reopened'),
    ('closed','reopened'),
    ('reopened','acknowledged'),('reopened','assigned'),('reopened','in_progress')
  )
$$;

-- ============ RLS POLICIES ============
CREATE POLICY "View accessible maintenance requests" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR tenant_id = auth.uid() OR public.can_review_building(building_id, auth.uid()));

CREATE POLICY "View attachments of accessible requests" ON public.maintenance_attachments
  FOR SELECT TO authenticated
  USING (public.can_view_maintenance_request(maintenance_request_id, auth.uid()));

CREATE POLICY "Add attachments to accessible requests" ON public.maintenance_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_view_maintenance_request(maintenance_request_id, auth.uid())
    AND (
      attachment_type <> 'completion_proof'::public.maintenance_attachment_type
      OR public.can_manage_maintenance_request(maintenance_request_id, auth.uid())
    )
  );

CREATE POLICY "View maintenance comments" ON public.maintenance_comments
  FOR SELECT TO authenticated
  USING (
    public.can_manage_maintenance_request(maintenance_request_id, auth.uid())
    OR (
      visibility = 'shared'::public.maintenance_comment_visibility
      AND public.can_view_maintenance_request(maintenance_request_id, auth.uid())
    )
  );

CREATE POLICY "Write maintenance comments" ON public.maintenance_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_view_maintenance_request(maintenance_request_id, auth.uid())
    AND (
      visibility = 'shared'::public.maintenance_comment_visibility
      OR public.can_manage_maintenance_request(maintenance_request_id, auth.uid())
    )
  );

CREATE POLICY "Edit own maintenance comment" ON public.maintenance_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Reviewers view work orders" ON public.work_orders
  FOR SELECT TO authenticated
  USING (public.can_review_building(building_id, auth.uid()));

CREATE POLICY "View status events of accessible requests" ON public.maintenance_status_events
  FOR SELECT TO authenticated
  USING (public.can_view_maintenance_request(maintenance_request_id, auth.uid()));

CREATE POLICY "Reviewers view work order events" ON public.work_order_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_orders w
    WHERE w.id = work_order_id AND public.can_review_building(w.building_id, auth.uid())
  ));

-- ============ TRIGGERS ============
CREATE TRIGGER maintenance_requests_updated_at BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER work_orders_updated_at BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.maintenance_events_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'maintenance history is append-only';
END;
$$;
CREATE TRIGGER mse_append_only BEFORE UPDATE OR DELETE ON public.maintenance_status_events
  FOR EACH ROW EXECUTE FUNCTION public.maintenance_events_append_only();
CREATE TRIGGER woe_append_only BEFORE UPDATE OR DELETE ON public.work_order_events
  FOR EACH ROW EXECUTE FUNCTION public.maintenance_events_append_only();

CREATE OR REPLACE FUNCTION public.maintenance_comment_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.author_id <> OLD.author_id
     OR NEW.maintenance_request_id <> OLD.maintenance_request_id
     OR NEW.visibility <> OLD.visibility
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'only the comment text may be edited';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER maintenance_comment_guard BEFORE UPDATE ON public.maintenance_comments
  FOR EACH ROW EXECUTE FUNCTION public.maintenance_comment_guard();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.create_maintenance_request(
  _building_id uuid,
  _category public.maintenance_category,
  _title text,
  _description text,
  _priority public.maintenance_priority DEFAULT 'medium',
  _is_common_area boolean DEFAULT false,
  _flat_id uuid DEFAULT NULL,
  _preferred_visit_date date DEFAULT NULL,
  _access_instructions text DEFAULT NULL
) RETURNS public.maintenance_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  actor_role public.app_role;
  req public.maintenance_requests;
  eff_flat uuid := _flat_id;
  eff_tenant uuid;
  flat_rec public.flats;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = actor;
  IF actor_role IS NULL THEN RAISE EXCEPTION 'Your profile is not ready yet.'; END IF;

  IF actor_role = 'tenant'::public.app_role THEN
    SELECT * INTO flat_rec FROM public.flats
     WHERE tenant_id = actor AND occupancy_status = 'occupied'::public.occupancy_status
     ORDER BY created_at LIMIT 1;
    IF flat_rec.id IS NULL THEN
      RAISE EXCEPTION 'You do not have an assigned flat, so you cannot submit a request.';
    END IF;
    IF flat_rec.building_id <> _building_id THEN
      RAISE EXCEPTION 'You may only report issues for your own building.';
    END IF;
    IF _is_common_area THEN
      eff_flat := NULL;
    ELSE
      eff_flat := flat_rec.id;
    END IF;
    eff_tenant := actor;
  ELSE
    IF NOT public.can_review_building(_building_id, actor) THEN
      RAISE EXCEPTION 'You are not allowed to manage maintenance for this building.';
    END IF;
    IF _is_common_area THEN
      eff_flat := NULL;
      eff_tenant := NULL;
    ELSE
      IF eff_flat IS NULL THEN RAISE EXCEPTION 'Choose the flat this issue belongs to.'; END IF;
      SELECT * INTO flat_rec FROM public.flats WHERE id = eff_flat;
      IF flat_rec.id IS NULL OR flat_rec.building_id <> _building_id THEN
        RAISE EXCEPTION 'That flat does not belong to the selected building.';
      END IF;
      eff_tenant := flat_rec.tenant_id;
    END IF;
  END IF;

  -- double-click / refresh protection
  IF EXISTS (
    SELECT 1 FROM public.maintenance_requests r
    WHERE r.submitted_by = actor AND r.building_id = _building_id
      AND lower(btrim(r.title)) = lower(btrim(_title))
      AND r.created_at > now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION 'You just submitted this request. Check "My requests" before submitting again.';
  END IF;

  INSERT INTO public.maintenance_requests (
    request_number, building_id, flat_id, tenant_id, submitted_by, category, title,
    description, priority, is_common_area, preferred_visit_date, access_instructions
  ) VALUES (
    'MR-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad(nextval('public.maintenance_request_number_seq')::text, 5, '0'),
    _building_id, eff_flat, eff_tenant, actor, _category, btrim(_title), btrim(_description),
    _priority, coalesce(_is_common_area, false), _preferred_visit_date,
    NULLIF(btrim(coalesce(_access_instructions, '')), '')
  ) RETURNING * INTO req;

  INSERT INTO public.maintenance_status_events (
    maintenance_request_id, previous_status, new_status, performed_by, note
  ) VALUES (req.id, NULL, 'submitted'::public.maintenance_status, actor, 'Request submitted');

  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_change_status(
  _request_id uuid, _new_status public.maintenance_status, _note text DEFAULT NULL
) RETURNS public.maintenance_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  req public.maintenance_requests;
  is_reviewer boolean;
  is_owner boolean;
  is_requester boolean;
  note text := NULLIF(btrim(coalesce(_note, '')), '');
  open_work integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;

  SELECT * INTO req FROM public.maintenance_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Maintenance request not found.'; END IF;

  is_reviewer := public.can_review_building(req.building_id, actor);
  is_owner := public.is_building_owner(req.building_id, actor);
  is_requester := (req.submitted_by = actor OR req.tenant_id = actor);

  IF NOT (is_reviewer OR is_requester) THEN
    RAISE EXCEPTION 'You are not allowed to update this request.';
  END IF;

  IF NOT public.maintenance_transition_allowed(req.status, _new_status) THEN
    RAISE EXCEPTION 'This request cannot move from % to %.', req.status, _new_status;
  END IF;

  IF _new_status = 'acknowledged'::public.maintenance_status THEN
    IF NOT is_reviewer THEN RAISE EXCEPTION 'Only the owner or an assigned manager can acknowledge a request.'; END IF;
    UPDATE public.maintenance_requests
       SET status = _new_status,
           acknowledged_by = coalesce(acknowledged_by, actor),
           acknowledged_at = coalesce(acknowledged_at, now())
     WHERE id = _request_id RETURNING * INTO req;

  ELSIF _new_status = 'assigned'::public.maintenance_status THEN
    IF NOT is_reviewer THEN RAISE EXCEPTION 'Only the owner or an assigned manager can assign a request.'; END IF;
    IF req.assigned_to IS NULL THEN RAISE EXCEPTION 'Choose who is responsible before moving this request to assigned.'; END IF;
    UPDATE public.maintenance_requests SET status = _new_status WHERE id = _request_id RETURNING * INTO req;

  ELSIF _new_status IN ('in_progress'::public.maintenance_status, 'waiting_for_parts'::public.maintenance_status) THEN
    IF NOT is_reviewer THEN RAISE EXCEPTION 'Only the owner or an assigned manager can update work progress.'; END IF;
    UPDATE public.maintenance_requests SET status = _new_status WHERE id = _request_id RETURNING * INTO req;

  ELSIF _new_status = 'resolved'::public.maintenance_status THEN
    IF NOT is_reviewer THEN RAISE EXCEPTION 'Only the owner or an assigned manager can resolve a request.'; END IF;
    IF note IS NULL THEN RAISE EXCEPTION 'A resolution note is required.'; END IF;
    SELECT count(*) INTO open_work FROM public.work_orders w
     WHERE w.maintenance_request_id = _request_id
       AND w.status IN ('draft'::public.work_order_status,'assigned'::public.work_order_status,'in_progress'::public.work_order_status);
    IF open_work > 0 THEN
      RAISE EXCEPTION 'Complete or cancel the % open work order(s) before resolving this request.', open_work;
    END IF;
    UPDATE public.maintenance_requests
       SET status = _new_status, resolution_note = note, resolved_by = actor, resolved_at = now()
     WHERE id = _request_id RETURNING * INTO req;

  ELSIF _new_status = 'closed'::public.maintenance_status THEN
    IF NOT (is_reviewer OR is_requester) THEN RAISE EXCEPTION 'You are not allowed to close this request.'; END IF;
    IF req.resolution_note IS NULL THEN RAISE EXCEPTION 'A resolution note is required before closing.'; END IF;
    IF req.reopened_at IS NOT NULL AND (req.resolved_at IS NULL OR req.resolved_at <= req.reopened_at) THEN
      RAISE EXCEPTION 'This request was reopened. Record the new resolution before closing it again.';
    END IF;
    UPDATE public.maintenance_requests
       SET status = _new_status, closed_by = actor, closed_at = now()
     WHERE id = _request_id RETURNING * INTO req;

  ELSIF _new_status = 'rejected'::public.maintenance_status THEN
    IF NOT is_owner THEN RAISE EXCEPTION 'Only the building owner can reject a request.'; END IF;
    IF note IS NULL THEN RAISE EXCEPTION 'A rejection reason is required.'; END IF;
    UPDATE public.maintenance_requests
       SET status = _new_status, rejection_reason = note, closed_by = actor, closed_at = now()
     WHERE id = _request_id RETURNING * INTO req;

  ELSIF _new_status = 'cancelled'::public.maintenance_status THEN
    IF NOT (is_requester OR is_owner) THEN RAISE EXCEPTION 'Only the person who submitted this request, or the owner, can cancel it.'; END IF;
    IF note IS NULL THEN RAISE EXCEPTION 'A cancellation reason is required.'; END IF;
    UPDATE public.maintenance_requests
       SET status = _new_status, cancellation_reason = note
     WHERE id = _request_id RETURNING * INTO req;

  ELSIF _new_status = 'reopened'::public.maintenance_status THEN
    IF NOT (is_reviewer OR is_requester) THEN RAISE EXCEPTION 'You are not allowed to reopen this request.'; END IF;
    IF note IS NULL THEN RAISE EXCEPTION 'A reopening reason is required.'; END IF;
    UPDATE public.maintenance_requests
       SET status = _new_status, reopening_reason = note, reopened_by = actor, reopened_at = now(),
           closed_by = NULL, closed_at = NULL
     WHERE id = _request_id RETURNING * INTO req;
  ELSE
    RAISE EXCEPTION 'Unsupported status change.';
  END IF;

  INSERT INTO public.maintenance_status_events (
    maintenance_request_id, previous_status, new_status, performed_by, note
  ) VALUES (_request_id, req.status, _new_status, actor, note);

  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_assign(
  _request_id uuid, _assigned_to uuid, _priority public.maintenance_priority DEFAULT NULL
) RETURNS public.maintenance_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  req public.maintenance_requests;
  prev public.maintenance_status;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO req FROM public.maintenance_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Maintenance request not found.'; END IF;
  IF NOT public.can_review_building(req.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage maintenance for this building.';
  END IF;
  IF req.status IN ('closed'::public.maintenance_status,'rejected'::public.maintenance_status,'cancelled'::public.maintenance_status) THEN
    RAISE EXCEPTION 'This request is no longer active.';
  END IF;
  IF _assigned_to IS NOT NULL AND NOT public.can_review_building(req.building_id, _assigned_to) THEN
    RAISE EXCEPTION 'That person is not an owner or assigned manager of this building.';
  END IF;

  prev := req.status;

  UPDATE public.maintenance_requests
     SET assigned_to = _assigned_to,
         assigned_at = CASE WHEN _assigned_to IS NULL THEN NULL ELSE now() END,
         priority = coalesce(_priority, priority),
         acknowledged_by = coalesce(acknowledged_by, actor),
         acknowledged_at = coalesce(acknowledged_at, now()),
         status = CASE
           WHEN _assigned_to IS NOT NULL
            AND prev IN ('submitted'::public.maintenance_status,'acknowledged'::public.maintenance_status,'reopened'::public.maintenance_status)
           THEN 'assigned'::public.maintenance_status ELSE status END
   WHERE id = _request_id RETURNING * INTO req;

  INSERT INTO public.maintenance_status_events (
    maintenance_request_id, previous_status, new_status, performed_by, note
  ) VALUES (
    _request_id, prev, req.status, actor,
    CASE WHEN _assigned_to IS NULL THEN 'Assignment cleared' ELSE 'Request assigned' END
  );

  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_set_priority(
  _request_id uuid, _priority public.maintenance_priority
) RETURNS public.maintenance_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); req public.maintenance_requests;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO req FROM public.maintenance_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Maintenance request not found.'; END IF;
  IF NOT public.can_review_building(req.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage maintenance for this building.';
  END IF;
  UPDATE public.maintenance_requests SET priority = _priority WHERE id = _request_id RETURNING * INTO req;
  INSERT INTO public.maintenance_status_events (
    maintenance_request_id, previous_status, new_status, performed_by, note
  ) VALUES (_request_id, req.status, req.status, actor, 'Priority set to ' || _priority::text);
  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_order_create(
  _maintenance_request_id uuid,
  _work_description text,
  _assigned_manager_id uuid DEFAULT NULL,
  _vendor_name text DEFAULT NULL,
  _vendor_phone text DEFAULT NULL,
  _technician_name text DEFAULT NULL,
  _scheduled_date date DEFAULT NULL,
  _scheduled_time text DEFAULT NULL,
  _estimated_cost numeric DEFAULT NULL
) RETURNS public.work_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  req public.maintenance_requests;
  wo public.work_orders;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO req FROM public.maintenance_requests WHERE id = _maintenance_request_id;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Maintenance request not found.'; END IF;
  IF NOT public.can_review_building(req.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage maintenance for this building.';
  END IF;
  IF req.status IN ('closed'::public.maintenance_status,'rejected'::public.maintenance_status,'cancelled'::public.maintenance_status) THEN
    RAISE EXCEPTION 'This request is no longer active.';
  END IF;
  IF _assigned_manager_id IS NOT NULL AND NOT public.can_review_building(req.building_id, _assigned_manager_id) THEN
    RAISE EXCEPTION 'That person is not an owner or assigned manager of this building.';
  END IF;

  INSERT INTO public.work_orders (
    work_order_number, maintenance_request_id, building_id, assigned_manager_id, vendor_name,
    vendor_phone, technician_name, scheduled_date, scheduled_time, estimated_cost,
    status, work_description, created_by
  ) VALUES (
    'WO-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad(nextval('public.work_order_number_seq')::text, 5, '0'),
    req.id, req.building_id, _assigned_manager_id,
    NULLIF(btrim(coalesce(_vendor_name,'')),''), NULLIF(btrim(coalesce(_vendor_phone,'')),''),
    NULLIF(btrim(coalesce(_technician_name,'')),''), _scheduled_date,
    NULLIF(btrim(coalesce(_scheduled_time,'')),''), _estimated_cost,
    CASE WHEN _assigned_manager_id IS NULL THEN 'draft'::public.work_order_status
         ELSE 'assigned'::public.work_order_status END,
    btrim(_work_description), actor
  ) RETURNING * INTO wo;

  INSERT INTO public.work_order_events (work_order_id, previous_status, new_status, performed_by, note)
  VALUES (wo.id, NULL, wo.status, actor, 'Work order created');

  RETURN wo;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_order_update_status(
  _work_order_id uuid, _new_status public.work_order_status,
  _note text DEFAULT NULL, _actual_cost numeric DEFAULT NULL
) RETURNS public.work_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); wo public.work_orders; prev public.work_order_status;
  note text := NULLIF(btrim(coalesce(_note,'')),'');
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO wo FROM public.work_orders WHERE id = _work_order_id FOR UPDATE;
  IF wo.id IS NULL THEN RAISE EXCEPTION 'Work order not found.'; END IF;
  IF NOT public.can_review_building(wo.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage work orders for this building.';
  END IF;
  IF wo.status IN ('completed'::public.work_order_status,'cancelled'::public.work_order_status) THEN
    RAISE EXCEPTION 'This work order is already closed.';
  END IF;
  IF NOT (wo.status, _new_status) IN (
    ('draft','assigned'),('draft','cancelled'),
    ('assigned','in_progress'),('assigned','cancelled'),
    ('in_progress','completed'),('in_progress','cancelled')
  ) THEN
    RAISE EXCEPTION 'A work order cannot move from % to %.', wo.status, _new_status;
  END IF;
  IF _new_status = 'assigned'::public.work_order_status AND wo.assigned_manager_id IS NULL THEN
    RAISE EXCEPTION 'Set who is responsible before assigning this work order.';
  END IF;
  IF _new_status = 'completed'::public.work_order_status AND note IS NULL THEN
    RAISE EXCEPTION 'A completion note is required.';
  END IF;
  IF _new_status = 'cancelled'::public.work_order_status AND note IS NULL THEN
    RAISE EXCEPTION 'A cancellation reason is required.';
  END IF;

  prev := wo.status;
  UPDATE public.work_orders
     SET status = _new_status,
         actual_cost = coalesce(_actual_cost, actual_cost),
         completion_note = CASE WHEN _new_status = 'completed'::public.work_order_status THEN note ELSE completion_note END,
         completed_by = CASE WHEN _new_status = 'completed'::public.work_order_status THEN actor ELSE completed_by END,
         completed_at = CASE WHEN _new_status = 'completed'::public.work_order_status THEN now() ELSE completed_at END,
         cancellation_reason = CASE WHEN _new_status = 'cancelled'::public.work_order_status THEN note ELSE cancellation_reason END
   WHERE id = _work_order_id RETURNING * INTO wo;

  INSERT INTO public.work_order_events (work_order_id, previous_status, new_status, performed_by, note)
  VALUES (wo.id, prev, _new_status, actor, note);

  RETURN wo;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_order_update_details(
  _work_order_id uuid,
  _work_description text DEFAULT NULL,
  _assigned_manager_id uuid DEFAULT NULL,
  _vendor_name text DEFAULT NULL,
  _vendor_phone text DEFAULT NULL,
  _technician_name text DEFAULT NULL,
  _scheduled_date date DEFAULT NULL,
  _scheduled_time text DEFAULT NULL,
  _estimated_cost numeric DEFAULT NULL
) RETURNS public.work_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); wo public.work_orders;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO wo FROM public.work_orders WHERE id = _work_order_id FOR UPDATE;
  IF wo.id IS NULL THEN RAISE EXCEPTION 'Work order not found.'; END IF;
  IF NOT public.can_review_building(wo.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage work orders for this building.';
  END IF;
  IF wo.status IN ('completed'::public.work_order_status,'cancelled'::public.work_order_status) THEN
    RAISE EXCEPTION 'A completed or cancelled work order can no longer be edited.';
  END IF;
  IF _assigned_manager_id IS NOT NULL AND NOT public.can_review_building(wo.building_id, _assigned_manager_id) THEN
    RAISE EXCEPTION 'That person is not an owner or assigned manager of this building.';
  END IF;

  UPDATE public.work_orders
     SET work_description = coalesce(NULLIF(btrim(coalesce(_work_description,'')),''), work_description),
         assigned_manager_id = coalesce(_assigned_manager_id, assigned_manager_id),
         vendor_name = NULLIF(btrim(coalesce(_vendor_name,'')),''),
         vendor_phone = NULLIF(btrim(coalesce(_vendor_phone,'')),''),
         technician_name = NULLIF(btrim(coalesce(_technician_name,'')),''),
         scheduled_date = _scheduled_date,
         scheduled_time = NULLIF(btrim(coalesce(_scheduled_time,'')),''),
         estimated_cost = _estimated_cost
   WHERE id = _work_order_id RETURNING * INTO wo;
  RETURN wo;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_expense_draft_from_work_order(
  _work_order_id uuid,
  _category public.expense_category,
  _amount numeric,
  _description text,
  _expense_date date,
  _accounting_month date,
  _payment_method public.expense_payment_method DEFAULT 'cash',
  _vendor_name text DEFAULT NULL,
  _transaction_reference text DEFAULT NULL
) RETURNS public.building_expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); wo public.work_orders; exp public.building_expenses;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO wo FROM public.work_orders WHERE id = _work_order_id FOR UPDATE;
  IF wo.id IS NULL THEN RAISE EXCEPTION 'Work order not found.'; END IF;
  IF NOT public.can_review_building(wo.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to record expenses for this building.';
  END IF;
  IF wo.status <> 'completed'::public.work_order_status THEN
    RAISE EXCEPTION 'Only a completed work order can become an expense draft.';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter the amount actually spent.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.building_expenses e
    WHERE e.source_work_order_id = _work_order_id
      AND e.approval_status <> 'cancelled'::public.expense_approval_status
  ) THEN
    RAISE EXCEPTION 'An expense already exists for this work order.';
  END IF;

  INSERT INTO public.building_expenses (
    building_id, expense_date, accounting_month, category, description, vendor_name,
    amount, payment_method, transaction_reference, approval_status, created_by, source_work_order_id
  ) VALUES (
    wo.building_id, _expense_date, date_trunc('month', _accounting_month)::date, _category,
    btrim(_description), NULLIF(btrim(coalesce(_vendor_name, wo.vendor_name, '')),''),
    _amount, _payment_method, NULLIF(btrim(coalesce(_transaction_reference,'')),''),
    'pending'::public.expense_approval_status, actor, wo.id
  ) RETURNING * INTO exp;

  RETURN exp;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_tenant_schedule(_request_id uuid)
RETURNS TABLE (
  work_order_number text, status public.work_order_status, scheduled_date date,
  scheduled_time text, technician_name text, work_description text, completed_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT w.work_order_number, w.status, w.scheduled_date, w.scheduled_time,
         w.technician_name, w.work_description, w.completed_at
  FROM public.work_orders w
  WHERE w.maintenance_request_id = _request_id
    AND public.can_view_maintenance_request(_request_id, auth.uid())
  ORDER BY w.created_at
$$;

-- ============ FUNCTION GRANTS ============
REVOKE ALL ON FUNCTION public.can_view_maintenance_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_maintenance_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.maintenance_transition_allowed(public.maintenance_status, public.maintenance_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.maintenance_events_append_only() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.maintenance_comment_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_maintenance_request(uuid, public.maintenance_category, text, text, public.maintenance_priority, boolean, uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.maintenance_change_status(uuid, public.maintenance_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.maintenance_assign(uuid, uuid, public.maintenance_priority) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.maintenance_set_priority(uuid, public.maintenance_priority) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.work_order_create(uuid, text, uuid, text, text, text, date, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.work_order_update_status(uuid, public.work_order_status, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.work_order_update_details(uuid, text, uuid, text, text, text, date, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_expense_draft_from_work_order(uuid, public.expense_category, numeric, text, date, date, public.expense_payment_method, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.maintenance_tenant_schedule(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_view_maintenance_request(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_maintenance_request(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.maintenance_transition_allowed(public.maintenance_status, public.maintenance_status) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_maintenance_request(uuid, public.maintenance_category, text, text, public.maintenance_priority, boolean, uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.maintenance_change_status(uuid, public.maintenance_status, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.maintenance_assign(uuid, uuid, public.maintenance_priority) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.maintenance_set_priority(uuid, public.maintenance_priority) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.work_order_create(uuid, text, uuid, text, text, text, date, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.work_order_update_status(uuid, public.work_order_status, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.work_order_update_details(uuid, text, uuid, text, text, text, date, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_expense_draft_from_work_order(uuid, public.expense_category, numeric, text, date, date, public.expense_payment_method, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.maintenance_tenant_schedule(uuid) TO authenticated, service_role;

-- ============ STORAGE POLICIES ============
CREATE POLICY "Maintenance attachments upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-attachments'
    AND public.can_view_maintenance_request((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "Maintenance attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'maintenance-attachments'
    AND public.can_view_maintenance_request((storage.foldername(name))[1]::uuid, auth.uid())
  );
