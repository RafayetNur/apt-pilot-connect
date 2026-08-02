import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AssignTenantDialog } from "@/components/flats/assign-tenant-dialog";
import { FlatFormDialog } from "@/components/flats/flat-form-dialog";
import { OwnerShell } from "@/components/owner-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildingQueryOptions } from "@/lib/buildings";
import {
  assignTenant,
  createFlat,
  deleteFlat,
  flatTenantsQueryOptions,
  removeTenant,
  tenantProfilesQueryOptions,
  flatsQueryOptions,
  formatRent,
  occupancyLabel,
  updateFlat,
  type Flat,
  type TenantProfile,
  type FlatInput,
} from "@/lib/flats";

export const Route = createFileRoute("/_authenticated/owner/flats/$buildingId")({
  head: () => ({
    meta: [
      { title: "Manage flats — AptPilot" },
      {
        name: "description",
        content: "Add, edit and remove flats for one of your AptPilot buildings.",
      },
      { property: "og:title", content: "Manage flats — AptPilot" },
      {
        property: "og:description",
        content: "Flat numbers, floors, bedrooms, bathrooms, rent and occupancy status.",
      },
    ],
  }),
  component: ManageFlatsPage,
});

function ManageFlatsPage() {
  const { buildingId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: building } = useQuery(buildingQueryOptions(buildingId));
  const { data: flats, isLoading, error } = useQuery(flatsQueryOptions(buildingId));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Flat | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Flat | null>(null);
  const [assigning, setAssigning] = useState<Flat | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Flat | null>(null);

  const tenantIds = (flats ?? []).map((flat) => flat.tenant_id).filter(Boolean) as string[];
  const { data: tenantMap } = useQuery(flatTenantsQueryOptions(tenantIds));
  const { data: tenantOptions, isLoading: tenantsLoading } = useQuery({
    ...tenantProfilesQueryOptions(),
    enabled: assigning !== null,
  });

  const invalidateFlats = async () => {
    await queryClient.invalidateQueries({ queryKey: ["flats", buildingId] });
    await queryClient.invalidateQueries({ queryKey: ["flat-tenants"] });
  };

  const assignMutation = useMutation({
    mutationFn: async ({ flatId, tenantId }: { flatId: string; tenantId: string }) =>
      assignTenant(flatId, tenantId),
    onSuccess: async () => {
      toast.success("Tenant assigned");
      setAssigning(null);
      await invalidateFlats();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeTenantMutation = useMutation({
    mutationFn: async (flatId: string) => removeTenant(flatId),
    onSuccess: async () => {
      toast.success("Tenant removed");
      setPendingRemove(null);
      await invalidateFlats();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const tenantFor = (flat: Flat): TenantProfile | null =>
    flat.tenant_id ? (tenantMap?.[flat.tenant_id] ?? null) : null;

  const saveMutation = useMutation({
    mutationFn: async (input: FlatInput) =>
      editing ? updateFlat(editing.id, input) : createFlat(buildingId, input),
    onSuccess: async () => {
      toast.success(editing ? "Flat updated" : "Flat added");
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["flats", buildingId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteFlat(id),
    onSuccess: async () => {
      toast.success("Flat deleted");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["flats", buildingId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = flats ?? [];

  return (
    <OwnerShell>
      <Link
        to="/owner/buildings/$buildingId"
        params={{ buildingId }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to building
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Flats</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {building ? building.name : "Manage the flats in this building."}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add flat
        </Button>
      </div>

      <section className="panel mt-8 p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading flats…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            Could not load flats: {(error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-display text-lg font-semibold">No flats yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the first flat to start tracking this building.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flat number</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Bedrooms</TableHead>
                    <TableHead>Bathrooms</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((flat) => (
                    <TableRow key={flat.id}>
                      <TableCell className="font-medium">{flat.flat_number}</TableCell>
                      <TableCell>{flat.floor_number}</TableCell>
                      <TableCell>{flat.bedroom_count}</TableCell>
                      <TableCell>{flat.bathroom_count}</TableCell>
                      <TableCell>{formatRent(flat.monthly_rent)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={flat.occupancy_status === "occupied" ? "default" : "secondary"}
                        >
                          {occupancyLabel[flat.occupancy_status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tenantFor(flat) ? (
                          <div className="text-sm">
                            <p className="font-medium">{tenantFor(flat)!.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {tenantFor(flat)!.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tenantFor(flat)!.phone || "No phone"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {flat.tenant_id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove tenant from flat ${flat.flat_number}`}
                            onClick={() => setPendingRemove(flat)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Assign tenant to flat ${flat.flat_number}`}
                            onClick={() => setAssigning(flat)}
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit flat ${flat.flat_number}`}
                          onClick={() => {
                            setEditing(flat);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label={`Delete flat ${flat.flat_number}`}
                          onClick={() => setPendingDelete(flat)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {rows.map((flat) => (
                <li key={flat.id} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold">{flat.flat_number}</p>
                      <p className="text-sm text-muted-foreground">
                        Floor {flat.floor_number} · {flat.bedroom_count} bed ·{" "}
                        {flat.bathroom_count} bath
                      </p>
                      <p className="mt-1 text-sm font-medium">{formatRent(flat.monthly_rent)}</p>
                    </div>
                    <Badge
                      variant={flat.occupancy_status === "occupied" ? "default" : "secondary"}
                    >
                      {occupancyLabel[flat.occupancy_status]}
                    </Badge>
                  </div>
                  {tenantFor(flat) ? (
                    <div className="mt-3 rounded-lg bg-surface p-3 text-sm">
                      <p className="font-medium">{tenantFor(flat)!.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{tenantFor(flat)!.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenantFor(flat)!.phone || "No phone"}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flat.tenant_id ? (
                      <Button variant="outline" size="sm" onClick={() => setPendingRemove(flat)}>
                        <UserMinus className="mr-2 h-4 w-4" />
                        Remove tenant
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setAssigning(flat)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Assign tenant
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(flat);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setPendingDelete(flat)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <FlatFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        flat={editing}
        existingNumbers={rows.map((flat) => flat.flat_number)}
        saving={saveMutation.isPending}
        onSubmit={(input) => saveMutation.mutate(input)}
      />

      <AssignTenantDialog
        open={assigning !== null}
        onOpenChange={(open) => {
          if (!open) setAssigning(null);
        }}
        flatNumber={assigning?.flat_number ?? ""}
        tenants={tenantOptions ?? []}
        loading={tenantsLoading}
        saving={assignMutation.isPending}
        onSubmit={(tenantId) => {
          if (assigning) assignMutation.mutate({ flatId: assigning.id, tenantId });
        }}
      />

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove tenant from flat {pendingRemove?.flat_number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The flat will be marked vacant and the tenant will lose access to its details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingRemove) removeTenantMutation.mutate(pendingRemove.id);
              }}
              disabled={removeTenantMutation.isPending}
            >
              {removeTenantMutation.isPending ? "Removing…" : "Remove tenant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flat {pendingDelete?.flat_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the flat from this building. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OwnerShell>
  );
}
