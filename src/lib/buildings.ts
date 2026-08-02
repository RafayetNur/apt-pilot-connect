import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type BuildingStatus = "active" | "inactive";

export type Building = {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  area: string;
  floors: number;
  total_flats: number;
  assigned_manager: string;
  status: BuildingStatus;
  created_at: string;
  updated_at: string;
};

export type BuildingInput = {
  name: string;
  address: string;
  area: string;
  floors: number;
  total_flats: number;
  assigned_manager: string;
  status: BuildingStatus;
};

export const buildingsQueryOptions = () =>
  queryOptions({
    queryKey: ["buildings"],
    queryFn: async (): Promise<Building[]> => {
      const { data, error } = await supabase
        .from("buildings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Building[];
    },
  });

export const buildingQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["buildings", id],
    queryFn: async (): Promise<Building | null> => {
      const { data, error } = await supabase
        .from("buildings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Building | null) ?? null;
    },
  });

export async function createBuilding(input: BuildingInput) {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error("You must be signed in to add a building.");
  const { error } = await supabase.from("buildings").insert({ ...input, owner_id: ownerId });
  if (error) throw error;
}

export async function updateBuilding(id: string, input: BuildingInput) {
  const { error } = await supabase.from("buildings").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteBuilding(id: string) {
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) throw error;
}

export const statusLabel: Record<BuildingStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};
