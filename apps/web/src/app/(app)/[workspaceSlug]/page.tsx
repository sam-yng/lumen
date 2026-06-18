import { LibraryWorkspace } from "@/components/library/library-workspace";
import { signOut } from "@/server/auth/actions";
import { createServerSupabase } from "@/server/db/client";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LibraryWorkspace
      signOutAction={signOut}
      userEmail={user?.email ?? "Workspace member"}
      workspaceSlug={workspaceSlug}
    />
  );
}
