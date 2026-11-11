import "server-only";
import { createClient } from "@/lib/supabase/server";

export type GeneratorProject = {
  id: string;
  name: string;
  baseUrl: string;
  suites: { id: string; name: string }[];
};

/** Projects (with their suites) in the workspace, for the generator form. */
export async function listGeneratorProjects(workspaceId: string): Promise<GeneratorProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, base_url, test_suites(id, name)")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) throw new Error("Failed to load projects", { cause: error });
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.base_url,
    suites: [...p.test_suites].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
