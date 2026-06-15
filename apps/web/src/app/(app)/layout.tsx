import { redirect } from "next/navigation";
import { LegalFooter } from "@/components/legal-footer";
import { createServerSupabase } from "@/server/db/client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: the Proxy guards routing, but the protected shell
  // re-verifies the user server-side before rendering.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">{children}</div>
      </main>
      <LegalFooter />
    </div>
  );
}
