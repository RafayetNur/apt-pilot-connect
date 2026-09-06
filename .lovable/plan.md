# Fix: Manager access decided by an editable name field (revised plan)

Today a manager reaches a building if the building's typed-in "Assigned manager" text matches their own display name or email — both self-editable. The fix links a building to a manager by a permanent account ID. Nothing below is implemented yet; no schema, rules, data, code, types or settings have been touched.

## 1. Current vulnerable rules (captured verbatim, for the record)

`app_private.can_view_building(building_uuid, user_uuid)` — manager branch:

```sql
EXISTS (
  SELECT 1 FROM public.buildings b
  JOIN public.profiles p ON p.id = user_uuid
  WHERE b.id = building_uuid
    AND p.role = 'manager'
    AND btrim(b.assigned_manager) <> ''
    AND ( lower(btrim(b.assigned_manager)) = lower(btrim(p.email))
       OR lower(btrim(b.assigned_manager)) = lower(btrim(p.full_name)) )
)
```

`app_private.can_review_building(building_uuid, user_uuid)` — owner branch plus the identical manager branch.

Two policies inline the same text match instead of calling a helper:
- `flats` → "Managers can view flats of assigned buildings"
- `rent_records` → "Managers can view rent of assigned buildings"

Everything else inherits the flaw through those two helpers: `buildings`, `flats`, `rent_records`, `rent_payments`, `flat_bill_charges`, `bill_adjustments`, `building_expenses`, `building_month_closures`, `building_month_closure_events`, `maintenance_requests` (and via `can_view_maintenance_request` / `can_manage_maintenance_request`: attachments, comments, status events, work orders and work-order events), `building_notices`, `notice_recipients`, `notice_events`, `notice_acknowledgements`, `building_documents`, `document_recipients`, `shared_building_charges`, `shared_charge_allocations`, `sslcommerz_transactions`, `tenant_credits`, `profiles` (tenant rows via `can_review_tenant`), plus reporting routines `report_guard` / `report_accessible_buildings` and every `report_*` function that calls them.

`prevent_role_change()` protects `profiles.role`, but `full_name` and `email` stay self-editable — which is exactly what makes the text match exploitable.

## 2. Migration 1 — column and role validation (no behaviour change)

```sql
ALTER TABLE public.buildings
  ADD COLUMN assigned_manager_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX buildings_assigned_manager_id_idx
  ON public.buildings (assigned_manager_id);
```

Validation trigger (data integrity only — **not** an authorization trigger):

```sql
CREATE OR REPLACE FUNCTION app_private.validate_assigned_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.assigned_manager_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = NEW.assigned_manager_id
         AND p.role = 'manager'::public.app_role
     ) THEN
    RAISE EXCEPTION 'assigned_manager_id must reference a profile with role manager';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER buildings_validate_assigned_manager
  BEFORE INSERT OR UPDATE OF assigned_manager_id ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION app_private.validate_assigned_manager();
```

How it behaves under RLS, per the requirements:
- It is `SECURITY DEFINER` and owned by the migration role, so its `SELECT` on `public.profiles` runs as the owner and is **not** filtered by the profiles policies. Without this, an owner assigning a manager whose profile row they cannot read under RLS would get a spurious "not a manager" failure. This is the specific reason for DEFINER here.
- `SET search_path = ''` with every table, function and type fully schema-qualified (`public.profiles`, `public.app_role`). The `=` used is the built-in uuid/enum operator resolved from `pg_catalog`, which is always implicitly on the path and cannot be shadowed.
- It only validates data shape. It never inspects `auth.uid()` and never raises for service-role or migration/back-office work, so administration and future data fixes are not blocked.
- Authorization stays where it belongs: the existing owner-only `buildings` INSERT/UPDATE policies (`auth.uid() = owner_id AND app_private.has_role(auth.uid(),'owner')`) plus the RPC in section 5. A manager has **no** UPDATE policy on `buildings` at all, so a manager can never write `assigned_manager_id` — including to themselves. This will be re-verified by assertion (8e), not assumed.

Role changing away from manager later: `prevent_role_change()` currently blocks self-service role changes, so this can only happen through an administrative path. If it ever does, the building keeps the stale `assigned_manager_id`, but access is *not* granted, because the helper in section 4 requires **both** `assigned_manager_id = auth.uid()` **and** `has_role(auth.uid(),'manager')`. Fail-closed by construction. A reporting query listing buildings whose `assigned_manager_id` no longer has the manager role is added to the ops checklist so owners can be told to re-assign.

## 3. Migration 2 — pre-check and narrow backfill

Abort-if-changed pre-check, run inside the same migration:

```sql
DO $$
DECLARE unique_rows int; ambiguous_rows int; unmatched_rows int;
BEGIN
  SELECT count(*) FILTER (WHERE m.c = 1),
         count(*) FILTER (WHERE m.c > 1),
         count(*) FILTER (WHERE m.c = 0)
    INTO unique_rows, ambiguous_rows, unmatched_rows
  FROM public.buildings b
  CROSS JOIN LATERAL (
    SELECT count(*) AS c FROM public.profiles p
    WHERE p.role = 'manager'::public.app_role
      AND lower(btrim(p.email)) = lower(btrim(b.assigned_manager))
  ) m;

  IF unique_rows <> 2 OR ambiguous_rows <> 0 OR unmatched_rows <> 0 THEN
    RAISE EXCEPTION
      'Mapping changed since audit (unique=%, ambiguous=%, unmatched=%) — abort and re-audit',
      unique_rows, ambiguous_rows, unmatched_rows;
  END IF;
END $$;
```

Audited state (read-only, 2026-09-06): 2 buildings — "Arcade valley" and "Shardar tower" — both labelled `teamapar10ms@gmail.com`, each matching exactly 1 manager profile by email. 0 ambiguous, 0 unmatched.

Backfill, email-verified and unique only:

```sql
UPDATE public.buildings b
SET assigned_manager_id = p.id
FROM public.profiles p
WHERE b.assigned_manager_id IS NULL
  AND p.role = 'manager'::public.app_role
  AND lower(btrim(p.email)) = lower(btrim(b.assigned_manager))
  AND (SELECT count(*) FROM public.profiles p2
        WHERE p2.role = 'manager'::public.app_role
          AND lower(btrim(p2.email)) = lower(btrim(b.assigned_manager))) = 1;
```

Name-only matches are never auto-mapped. The text column is not modified, not cleared, not dropped. Rows that do not qualify stay NULL and are reported to the owner to re-assign in the app.

## 4. Migration 3 — enforcement switch (single atomic transaction)

All of the following are one migration, which Postgres runs in a single transaction; any failure rolls the whole thing back and leaves today's behaviour intact. There is no intermediate state where one helper is fixed and the other is not.

1. `CREATE OR REPLACE FUNCTION app_private.can_view_building(...)` — manager branch replaced by:

```sql
EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.id = building_uuid
    AND b.assigned_manager_id = user_uuid
    AND app_private.has_role(user_uuid, 'manager'::public.app_role)
)
```

2. `CREATE OR REPLACE FUNCTION app_private.can_review_building(...)` — same replacement.
   Both keep `SECURITY DEFINER`, `STABLE`, and are re-declared with `SET search_path = ''` and fully qualified `public.` / `app_private.` / `pg_catalog` references. Owner and tenant branches unchanged.
3. `DROP POLICY` + `CREATE POLICY` for `flats` → `USING (app_private.can_view_building(building_id, auth.uid()))`.
4. `DROP POLICY` + `CREATE POLICY` for `rent_records` → `USING (app_private.can_view_building(building_id, auth.uid()))`.
5. Create the RPC in section 5.
6. Final in-transaction assertion: no policy expression and no routine body in `public`/`app_private` still contains `assigned_manager` as an authorization term — a `DO` block scanning `pg_policy` expressions and `pg_proc.prosrc` raises and rolls back if any remain.

Because every other manager-scoped policy already routes through the two helpers, steps 1–4 fix all listed surfaces: buildings, flats, rent_records, rent_payments, flat_bill_charges, bill_adjustments, building_expenses, maintenance requests + attachments/comments/history/work orders, notices + recipients/events/acknowledgements, documents + recipients, shared charges/allocations, tenant credits, gateway transactions, month closures, and all `report_*` routines. Step 6 proves it rather than trusting the inheritance.

## 5. Owner-only assignment RPC

```sql
CREATE OR REPLACE FUNCTION public.assign_building_manager(
  _building_id uuid,
  _manager_id  uuid  -- NULL clears the assignment
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- caller must be the OWNER OF THIS BUILDING; no owner id is accepted as an argument
  IF NOT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = _building_id
      AND b.owner_id = v_caller
      AND app_private.has_role(v_caller, 'owner'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the owner of this building can assign its manager';
  END IF;

  IF _manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _manager_id AND p.role = 'manager'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Selected account is not a manager';
  END IF;

  UPDATE public.buildings b
  SET assigned_manager_id = _manager_id,
      assigned_manager = COALESCE(
        (SELECT p.email FROM public.profiles p WHERE p.id = _manager_id), ''),
      updated_at = now()
  WHERE b.id = _building_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_building_manager(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_building_manager(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_building_manager(uuid, uuid) TO authenticated;
```

Hardening notes: `SET search_path = ''`, every reference schema-qualified (`public.*`, `app_private.*`, `auth.uid()`, `pg_catalog` operators); ownership is derived **only** from `auth.uid()` — no caller-supplied owner ID exists in the signature, so there is nothing to spoof; a manager calling it fails the owner check and therefore cannot assign themselves; `service_role` is intentionally not granted (administration goes through migrations). This becomes the only supported assign/remove path. `now()` is `pg_catalog.now()`.

## 6. Deployment coordination (no misleading window)

The risk is a period where an owner assigns a manager in the UI and the save appears to work but access is still decided by text (or vice-versa). Ordering that closes it:

1. Migration 1 (column + validation trigger). Reads/writes unchanged; both apps keep working exactly as today.
2. Read the mapping report; confirm the counts still match section 3.
3. Migration 2 (backfill). Access still decided by text; the new column now shadows it correctly for both existing buildings.
4. Verification pass proving each currently-working manager resolves through `assigned_manager_id` **before** enforcement flips.
5. Regenerate Supabase TypeScript types so `assigned_manager_id` and the RPC signature exist in `src/integrations/supabase/types.ts` and `mobile/lib/database.types.ts`. Types-only; no runtime change.
6. Ship the web + mobile UI changes (section 7) that assign via the RPC with a real profile UUID, while text-writing is removed. At this point assignment writes the UUID — which already governs nothing yet, but is already correct.
7. Migration 3 (enforcement switch), atomic. From this instant the UUID is authoritative and every assignment made in step 6 is exactly what takes effect.
8. Later, separate cleanup migration: stop writing the legacy text column, then drop it.

Because the UI starts writing the UUID (step 6) *before* the UUID becomes authoritative (step 7), and the legacy text keeps governing until then, there is never a moment where a successful-looking assignment fails to change real access — the mirroring in the RPC keeps both representations in agreement throughout the overlap. Creating a building with no manager keeps working end to end: the column is nullable, the trigger skips NULL, the RPC is not called, and existing INSERT policies are unchanged.

## 7. Application changes (exact files)

Types (regenerated, not hand-edited):
- `src/integrations/supabase/types.ts`
- `mobile/lib/database.types.ts`

Web:
- `src/lib/buildings.ts` — add `assigned_manager_id` to `Building`; drop `assigned_manager` from `BuildingInput` writes; add `assignBuildingManager()` calling the RPC; select the joined manager profile for display.
- `src/components/buildings/building-form-dialog.tsx` — replace the free-text input with a manager picker over manager profiles (value = profile UUID, label = full name + email).
- `src/routes/_authenticated/owner/buildings/index.tsx` — list card + table cell show the joined profile name, not the legacy text.
- `src/routes/_authenticated/owner/buildings/$buildingId.tsx` — detail row shows the joined profile name.

Mobile:
- `mobile/lib/owner/buildings.ts` — types + payload; assignment goes through the RPC.
- `mobile/app/(owner)/managers.tsx` — the edit modal becomes a manager picker.
- `mobile/app/(owner)/properties.tsx` — display from the joined profile; edit payload via RPC.
- `mobile/app/(owner)/property-details.tsx` — same.
- `mobile/components/owner-manager-label.tsx` — becomes a name/email renderer for a joined profile; the legacy free-text parsing heuristic is retired.
- `mobile/app/(tenant)/profile.tsx` — **existing bug**: it passes `assigned_manager` (text) into `profiles.id` (uuid), so the tenant's manager contact is currently always blank. Switch the lookup to `assigned_manager_id`.
- `mobile/lib/manager/shared.ts` — comment only; it relies on the rules and needs no logic change.

In every display the human-readable manager name comes from the joined `profiles` row; the legacy text is never treated as authoritative.

Unrelated and untouched: `work_orders.assigned_manager_id` is a pre-existing, already-correct UUID column.

## 8. Verification

SQL assertions (run after the relevant migration; each raises on failure).

a. Every backfilled ID resolves to a manager profile and matches the audited label:
```sql
SELECT b.id, b.name, b.assigned_manager, b.assigned_manager_id, p.role
FROM public.buildings b JOIN public.profiles p ON p.id = b.assigned_manager_id;
-- expect exactly 2 rows, both role = 'manager', emails equal to b.assigned_manager
```
b. Zero ambiguous mappings:
```sql
SELECT count(*) FROM public.buildings b
WHERE (SELECT count(*) FROM public.profiles p
        WHERE p.role='manager'::public.app_role
          AND lower(btrim(p.email))=lower(btrim(b.assigned_manager))) > 1;
-- expect 0
```
c. M1 cannot read Building 2 — as M1's JWT: `SELECT app_private.can_view_building('<b2>', '<m1>')` → false, and `SELECT count(*) FROM public.buildings WHERE id='<b2>'` → 0. Repeat for rent_records, rent_payments, flat_bill_charges, bill_adjustments, building_expenses, maintenance_requests, building_notices, building_documents scoped to Building 2 → all 0.
d. Renaming does not change authorization: update M1's `full_name`/`email` to M2's values, re-run (c) → still false/0.
e. A manager cannot update the assignment: as M1, `UPDATE public.buildings SET assigned_manager_id='<m1>' WHERE id='<b2>'` → 0 rows affected / policy violation. Also `SELECT public.assign_building_manager('<b2>','<m1>')` → raises.
f. An owner cannot assign someone else's building: as Owner A, `SELECT public.assign_building_manager('<b2>','<m2>')` → raises.
g. A tenant cannot be assigned as manager: as Owner A, `SELECT public.assign_building_manager('<b1>','<tenant>')` → raises; direct `UPDATE` with that ID → trigger raises.
h. No authorization surface still reads the text: the `pg_policy` / `pg_proc` scan from Migration 3 step 6 returns zero rows.

Regression checks (web and mobile, both platforms, real device or simulator for mobile):
- M1: dashboard, bills, payments, expenses, maintenance, notices, documents, reports for Building 1 → all load as before.
- M1: same screens for Building 2 → absent or empty, never partially populated.
- M2: mirror of the above with roles swapped.
- Owner A: assign M2 to Building 1 via the picker, confirm M2 gains access, remove, confirm M2 loses it, M1 unaffected.
- Owner A: create a new building with no manager → succeeds; it appears with "No manager"; no manager can reach it.
- Tenant of Building 1: dashboard, bills, repairs, notices unchanged; mobile profile now shows the real manager name and phone.
- Owner A and Owner B: reports, month closings, financial pages produce the same figures as before the change.

## 9. Rollback

The vulnerable name-matching authorization is **never** restored as a rollback. Options, in order of preference:

1. **Before Migration 3** — nothing is exposed yet, because access is still governed the old way. Revert the app deployment and, if desired, `UPDATE public.buildings SET assigned_manager_id = NULL;` then `ALTER TABLE public.buildings DROP COLUMN assigned_manager_id;` plus dropping the trigger/function. No data lost; the text column was never modified.
2. **After Migration 3, emergency** — fail closed: replace the manager branch of both helpers with `false` in one transaction. Owners and tenants keep full access; managers temporarily lose access and see empty screens. This is a visible degradation, not a silent security regression, and is reversible in one statement once the cause is fixed.
3. **Full revert of the deployment** — roll back the app release together with option 2, then re-apply the corrected enforcement migration.

Nothing in these paths deletes or overwrites an existing manager assignment, in either representation.
