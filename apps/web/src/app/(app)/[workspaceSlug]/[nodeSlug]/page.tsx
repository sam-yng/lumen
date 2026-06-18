import { redirect } from "next/navigation";
import { resolveLibraryNodeRoute } from "@/components/library/library-route-resolution";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { signOut } from "@/server/auth/actions";
import { createServerSupabase } from "@/server/db/client";
import type { ServiceSupabaseClient } from "@/server/services/context";
import { getLibraryNodeSnapshot } from "@/server/services/library-nodes";

export default async function NodePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; nodeSlug: string }>;
}) {
  const [{ workspaceSlug, nodeSlug }, supabase] = await Promise.all([
    params,
    createServerSupabase(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const snapshot = await getLibraryNodeSnapshot({
      userId: user.id,
      supabase: supabase as unknown as ServiceSupabaseClient,
    });
    const resolution = resolveLibraryNodeRoute(
      snapshot,
      workspaceSlug,
      nodeSlug,
    );
    if (resolution.kind === "redirect") redirect(resolution.href);
  }

  return (
    <LibraryWorkspace
      signOutAction={signOut}
      userEmail={user?.email ?? "Workspace member"}
      workspaceSlug={workspaceSlug}
      nodeSlug={nodeSlug}
    />
  );
}
