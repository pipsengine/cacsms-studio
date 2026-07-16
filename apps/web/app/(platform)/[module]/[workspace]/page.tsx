import { ModuleWorkspace } from "@/features/module-workspace";
export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params
}: {
  params: Promise<{ module: string; workspace: string }>;
}) {
  const resolvedParams = await params;

  return <ModuleWorkspace moduleSlug={resolvedParams.module} workspaceSlug={resolvedParams.workspace} />;
}
