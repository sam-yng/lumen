import { LibraryWorkspace } from "@/components/library/library-workspace";
import { signOut } from "@/server/auth/actions";
import { createServerSupabase } from "@/server/db/client";

export default async function NodePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; nodeSlug: string }>;
}) {
  const { workspaceSlug, nodeSlug } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LibraryWorkspace
      signOutAction={signOut}
      userEmail={user?.email ?? "Workspace member"}
      workspaceSlug={workspaceSlug}
      nodeSlug={nodeSlug}
    />
  );
}
