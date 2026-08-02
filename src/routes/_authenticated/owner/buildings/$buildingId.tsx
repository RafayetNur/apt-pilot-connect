import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
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
  buildingQueryOptions,
  deleteBuilding,
  statusLabel,
  updateBuilding,
  type BuildingInput,
} from "@/lib/buildings";

export const Route = createFileRoute("/_authenticated/owner/buildings/$buildingId")({
  head: () => ({
    meta: [
      { title: "Building details — AptPilot" },
      {
        name: "description",
        content: "Full details for one of your AptPilot buildings, including floors and flats.",
      },
      { property: "og:title", content: "Building details — AptPilot" },
      {
        property: "og:description",
        content: "Review address, area, floors, flats, manager and status for this building.",
      },
    ],
  }),
  component: BuildingDetailPage,
});

function BuildingDetailPage() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: building, isLoading, error } = useQuery(buildingQueryOptions(buildingId));
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (input: BuildingInput) => updateBuilding(buildingId, input),
    onSuccess: async () => {
      toast.success("Building updated");
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["buildings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => deleteBuilding(buildingId),
    onSuccess: async () => {
      toast.success("Building deleted");
      await queryClient.invalidateQueries({ queryKey: ["buildings"] });
      navigate({ to: "/owner/buildings", replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <OwnerShell>
      <Link
        to="/owner/buildings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to buildings
      </Link>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading building…</p>
      ) : error ? (
        <p className="mt-8 text-sm text-destructive">
          Could not load this building: {(error as Error).message}
        </p>
      ) : !building ? (
        <div className="panel mt-8 p-8">
          <h1 className="font-display text-2xl font-semibold">Building not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been deleted, or it does not belong to your account.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold">{building.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{building.address}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFormOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          <section className="panel mt-8 p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold">Building details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Detail label="Area" value={building.area || "—"} />
              <Detail label="Number of floors" value={String(building.floors)} />
              <Detail label="Total flats" value={String(building.total_flats)} />
              <Detail label="Assigned manager" value={building.assigned_manager || "—"} />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge variant={building.status === "active" ? "default" : "secondary"}>
                    {statusLabel[building.status]}
                  </Badge>
                </dd>
              </div>
              <Detail
                label="Added on"
                value={new Date(building.created_at).toLocaleDateString()}
              />
            </dl>
          </section>

          <BuildingFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            building={building}
            saving={saveMutation.isPending}
            onSubmit={(input) => saveMutation.mutate(input)}
          />

          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {building.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the building from your portfolio. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </OwnerShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
