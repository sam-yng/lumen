import { redirect } from "next/navigation";
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

  return <main className="flex min-h-dvh bg-background">{children}</main>;
}
