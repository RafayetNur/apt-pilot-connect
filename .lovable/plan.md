# Fix: Manager access decided by an editable name field

Today a manager gets into a building if the building's typed-in "Assigned manager" text matches their own display name or email — both of which the manager can edit. Renaming yourself can therefore open another manager's building and its money records. The fix is to link a building to a manager by a permanent account ID instead of typed text.

Nothing below is implemented yet.

## 1. Current vulnerable rules (as they exist now)

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

`app_private.can_review_building(building_uuid, user_uuid)` — identical manager branch (owner branch + this).

One policy inlines the same text match instead of calling a helper:

- `flats` → "Managers can view flats of assigned buildings"
- `rent_records` → "Managers can view rent of assigned buildings"

Everything else inherits the flaw through the two helpers, which are used by:
`buildings`, `flats`, `rent_records`, `rent_payments`, `flat_bill_charges`, `bill_adjustments`, `building_expenses`, `building_month_closures`, `building_month_closure_events`, `maintenance_requests` (and, via `can_view_maintenance_request` / `can_manage_maintenance_request`, its attachments, comments and status history), `building_notices`, `notice_recipients`, `notice_events`, `notice_acknowledgements`, `building_documents`, `document_recipients`, `shared_building_charges`, `shared_charge_allocations`, `sslcommerz_transactions`, `tenant_credits`, `work_orders`, `work_order_events`, `profiles` (tenant visibility via `can_review_tenant`), plus the reporting routines `report_guard` / `report_accessible_buildings`.

Also note `profiles` has `prevent_role_change()` but `full_name` and `email` remain self-editable — which is exactly what makes the text match exploitable.

## 2. Proposed schema change (migration 1)

```sql
ALTER TABLE public.buildings
  ADD COLUMN assigned_manager_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX buildings_assigned_manager_id_idx
  ON public.buildings (assigned_manager_id);
```

- `assigned_manager` (text) is kept, unchanged, for display and backward compatibility only. It stops being an access decision the moment migration 3 lands.
- A trigger enforces that a row in `assigned_manager_id` must belong to a profile whose role is `manager` (a CHECK cannot cross tables).

## 3. Mapping audit before any backfill (read-only report)

Report query (run and read the output; do not write from it blindly):

```sql
SELECT b.id, b.name, b.assigned_manager,
       (SELECT count(*) FROM public.profiles p
         WHERE p.role = 'manager'
           AND (lower(btrim(p.email))     = lower(btrim(b.assigned_manager))
             OR lower(btrim(p.full_name)) = lower(btrim(b.assigned_manager)))) AS match_count
FROM public.buildings b;
```

Classification: `match_count = 1` → safe to backfill; `= 0` → unmatched, leave NULL and report; `> 1` → ambiguous, leave NULL and report. Email matches are preferred over name matches; a name-only match with no email match is treated as *needs owner confirmation*, not auto-mapped.

Current state of this project's data (checked read-only just now): 2 buildings, both labelled `teamapar10ms@gmail.com`, each matching exactly 1 manager profile by email → both are uniquely mappable, 0 ambiguous, 0 unmatched.

## 4. Backfill (migration 2, only unique + email-verified rows)

```sql
UPDATE public.buildings b
SET assigned_manager_id = p.id
FROM public.profiles p
WHERE b.assigned_manager_id IS NULL
  AND p.role = 'manager'
  AND lower(btrim(p.email)) = lower(btrim(b.assigned_manager))
  AND (SELECT count(*) FROM public.profiles p2
        WHERE p2.role = 'manager'
          AND lower(btrim(p2.email)) = lower(btrim(b.assigned_manager))) = 1;
```

No existing text assignment is deleted or overwritten. Rows that do not qualify stay NULL and are handed to the owner to re-assign in the app.

## 5. Rules rewrite (migration 3)

Replace both helper bodies' manager branch with:

```sql
EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.id = building_uuid
    AND b.assigned_manager_id = user_uuid
    AND app_private.has_role(user_uuid, 'manager'::public.app_role)
)
```

Owner and tenant branches are unchanged. Then drop and recreate the two inlined policies so they simply call the helper:

- `flats` → `USING (app_private.can_view_building(building_id, auth.uid()))`
- `rent_records` → `USING (app_private.can_view_building(building_id, auth.uid()))`

Because every other manager-scoped policy already routes through `can_view_building` / `can_review_building`, all tables in the request list (buildings, flats, rent_records, rent_payments, flat_bill_charges, bill_adjustments, building_expenses, maintenance requests + attachments/comments/history, notices + acknowledgements/recipients/events, documents + recipients) are fixed by these three edits. Each will still be re-listed and confirmed individually during implementation.

## 6. Preventing self-assignment (migration 3)

- The existing `buildings` UPDATE/INSERT policies are already owner-only (`auth.uid() = owner_id AND has_role(owner)`), so a manager cannot write `assigned_manager_id` at all. This is re-verified rather than assumed.
- Add a `BEFORE UPDATE` trigger on `buildings` that rejects a change to `assigned_manager_id` unless the caller is the building's owner (defence in depth, also covers server-side paths).
- Managers gain no owner capability: `is_building_owner` stays owner-only and is untouched.

## 7. Owner-only assignment operation

```sql
public.assign_building_manager(_building_id uuid, _manager_id uuid)  -- NULL clears
```
SECURITY DEFINER, `search_path = public`, EXECUTE granted to `authenticated` only. It asserts the caller owns the building and has role `owner`, asserts the target profile has role `manager`, sets `assigned_manager_id`, and mirrors the manager's email into the display text so the two never disagree. This becomes the only supported way to assign or remove a manager.

## 8. Files that read or write the free-text value

Web:
- `src/lib/buildings.ts` (`Building`, `BuildingInput` types, create/update)
- `src/components/buildings/building-form-dialog.tsx` (free-text input → replace with a manager picker)
- `src/routes/_authenticated/owner/buildings/index.tsx` (list + table cells)
- `src/routes/_authenticated/owner/buildings/$buildingId.tsx` (detail row)

Mobile:
- `mobile/lib/owner/buildings.ts` (types, update payload)
- `mobile/app/(owner)/managers.tsx` (edit modal writing the text)
- `mobile/app/(owner)/properties.tsx` (display + edit payload)
- `mobile/app/(owner)/property-details.tsx` (display + edit payload)
- `mobile/components/owner-manager-label.tsx` (display parser)
- `mobile/app/(tenant)/profile.tsx` — **latent bug**: it passes `assigned_manager` (text) into `profiles.id` (uuid), so tenant "your manager" contact is currently always blank/erroring; switching to `assigned_manager_id` fixes it
- `mobile/lib/manager/shared.ts` (comment only; relies on the rules, no change needed)

Not affected: `work_orders.assigned_manager_id` already exists and is a real UUID column — unrelated to this defect.

## 9. Implementation order

1. Migration 1 — add nullable column, index, role-validation trigger. No behaviour change.
2. Run the mapping report; share ambiguous/unmatched rows with the owner.
3. Migration 2 — backfill unique email-verified rows only.
4. Verify every previously-working manager still resolves to their building via the new column *before* switching enforcement.
5. Migration 3 — rewrite the two helpers, replace the two inlined policies, add the assignment guard trigger and the owner-only assignment function.
6. Update web app: manager picker in the building form, read the new column, show the manager's real profile name.
7. Update mobile app: same picker, same reads, fix the tenant manager-contact lookup.
8. Later, separate cleanup: stop writing the text column, then drop it.

## 10. Rollback

- Migration 3 rollback: restore the two helper bodies and the two policies from their previous definitions (captured verbatim in section 1 before any change), drop the new trigger and function. Access reverts to today's behaviour instantly; no data lost.
- Migration 2 rollback: `UPDATE public.buildings SET assigned_manager_id = NULL;` — the text column was never modified, so assignments survive.
- Migration 1 rollback: `ALTER TABLE public.buildings DROP COLUMN assigned_manager_id;`
- App rollback: revert the frontend commits; they are independent of steps 1–2 and only required once step 5 lands.

## 11. Verification matrix

Set up: Owner A (Building 1), Owner B (Building 2), Manager M1 (assigned to Building 1), Manager M2 (assigned to Building 2).

| # | Actor | Action | Expected |
|---|---|---|---|
| 1 | M1 | Open Building 1 + its rent, payments, bills, adjustments, expenses, repairs, notices, documents | Allowed |
| 2 | M1 | Open Building 2 and each of the same screens | Blocked / empty |
| 3 | M2 | Mirror of 1 and 2 with roles swapped | Same outcomes |
| 4 | M1 | Rename own display name to M2's name, retry Building 2 | Still blocked (the key regression test) |
| 5 | M1 | Change own email to Building 2's old text label, retry | Still blocked |
| 6 | M1 | Attempt to set `assigned_manager_id` on any building (direct write and via the app) | Rejected |
| 7 | M1 | Attempt any owner-only action (delete building, approve as owner) | Rejected |
| 8 | Owner A | Assign M2 to Building 1, then remove | Works; M2 gains then loses access; M1 unaffected |
| 9 | Owner A | Try to assign a manager to Building 2 (not theirs) | Rejected |
| 10 | Owner B | Try to assign a tenant account as manager | Rejected |
| 11 | Tenant of Building 1 | Own dashboard, bills, repairs, notices | Unchanged from before |
| 12 | Owner A / Owner B | Reports, closings, financial pages | Unchanged from before |
| 13 | — | Building with `assigned_manager_id` NULL | No manager can reach it |

Device testing required for every mobile row (real device or simulator, both roles), since RLS behaviour differs from the web only in which screens surface the error.
