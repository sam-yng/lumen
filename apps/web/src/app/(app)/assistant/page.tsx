import { redirect } from "next/navigation";
import { AssistantConversation } from "@/components/assistant/assistant-conversation";
import { createServerSupabase } from "@/server/db/client";

export default async function AssistantPage() {
  // Defense in depth: the Proxy guards routing, but re-verify server-side.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AssistantConversation />;
}
