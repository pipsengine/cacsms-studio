import { ModuleWorkspace } from "@/features/module-workspace";

export default async function WorkspacePage({
  params
}: {
  params: Promise<{ module: string; workspace: string }>;
}) {
  const resolvedParams = await params;

  return <ModuleWorkspace moduleSlug={resolvedParams.module} workspaceSlug={resolvedParams.workspace} />;
}
