import { redirect } from "next/navigation";
import { LiveSessionRoute } from "@/components/library/live-session-route";

export default async function LiveSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string; workspaceId?: string }>;
}) {
  const { parentId, workspaceId } = await searchParams;
  if (!workspaceId) redirect("/");
  return (
    <LiveSessionRoute
      parentId={parentId && parentId.length > 0 ? parentId : null}
      workspaceId={workspaceId}
    />
  );
}
