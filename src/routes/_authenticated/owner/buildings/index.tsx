import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, DoorOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BuildingFormDialog } from "@/components/buildings/building-form-dialog";
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
import {
  buildingsQueryOptions,
  createBuilding,
  deleteBuilding,
  statusLabel,
  updateBuilding,
  type Building,
  type BuildingInput,
} from "@/lib/buildings";

export const Route = createFileRoute("/_authenticated/owner/buildings/")({
  head: () => ({
    meta: [
      { title: "Buildings — AptPilot" },
      {
        name: "description",
        content: "Owner tools to add, edit and manage every apartment building in your portfolio.",
      },
      { property: "og:title", content: "Buildings — AptPilot" },
      {
        property: "og:description",
        content: "Manage your apartment buildings, floors, flats and assigned managers.",
      },
    ],
  }),
  component: BuildingsPage,
});

function BuildingsPage() {
  const queryClient = useQueryClient();
  const { data: buildings, isLoading, error } = useQuery(buildingsQueryOptions());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Building | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["buildings"] });

  const saveMutation = useMutation({
    mutationFn: async (input: BuildingInput) =>
      editing ? updateBuilding(editing.id, input) : createBuilding(input),
    onSuccess: async () => {
      toast.success(editing ? "Building updated" : "Building added");
      setFormOpen(false);
      setEditing(null);
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteBuilding(id),
    onSuccess: async () => {
      toast.success("Building deleted");
      setPendingDelete(null);
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <OwnerShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Owner workspace
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Buildings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every building you own, with its address, floors, flats and assigned manager.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add building
        </Button>
      </div>

      <section className="panel mt-8 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading buildings…</p>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">
            Could not load buildings: {(error as Error).message}
          </p>
        ) : !buildings || buildings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Building2 className="h-6 w-6" />
            </span>
            <h2 className="font-display text-lg font-semibold">No buildings yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your first building to start organising floors, flats and managers.
            </p>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add building
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-border/60 md:hidden">
              {buildings.map((building) => (
                <li key={building.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        to="/owner/buildings/$buildingId"
                        params={{ buildingId: building.id }}
                        className="font-medium hover:underline"
                      >
                        {building.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{building.area}</p>
                    </div>
                    <StatusBadge status={building.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{building.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {building.floors} floors · {building.total_flats} flats ·{" "}
                    {building.assigned_manager || "No manager"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/owner/flats/$buildingId"
                        params={{ buildingId: building.id }}
                      >
                        <DoorOpen className="mr-2 h-3.5 w-3.5" />
                        Manage Flats
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(building);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(building)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Building</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead className="text-right">Floors</TableHead>
                    <TableHead className="text-right">Flats</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buildings.map((building) => (
                    <TableRow key={building.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/owner/buildings/$buildingId"
                          params={{ buildingId: building.id }}
                          className="hover:underline"
                        >
                          {building.name}
                        </Link>
                        <p className="text-xs font-normal text-muted-foreground">
                          {building.address}
                        </p>
                      </TableCell>
                      <TableCell>{building.area}</TableCell>
                      <TableCell className="text-right">{building.floors}</TableCell>
                      <TableCell className="text-right">{building.total_flats}</TableCell>
                      <TableCell>{building.assigned_manager || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={building.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" aria-label={`Manage flats for ${building.name}`}>
                            <Link
                              to="/owner/flats/$buildingId"
                              params={{ buildingId: building.id }}
                            >
                              <DoorOpen className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${building.name}`}
                            onClick={() => {
                              setEditing(building);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${building.name}`}
                            className="text-destructive"
                            onClick={() => setPendingDelete(building)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      <BuildingFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        building={editing}
        saving={saveMutation.isPending}
        onSubmit={(input) => saveMutation.mutate(input)}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the building from your portfolio. This cannot be undone.
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

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>{statusLabel[status]}</Badge>
  );
}
