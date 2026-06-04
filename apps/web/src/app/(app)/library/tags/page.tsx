import { LibraryWorkspace } from "@/components/library/library-workspace";
import { signOut } from "@/server/auth/actions";
import { createServerSupabase } from "@/server/db/client";

export default async function TagsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LibraryWorkspace
      signOutAction={signOut}
      userEmail={user?.email ?? "Workspace member"}
      view="tags"
    />
  );
}
