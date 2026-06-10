import { LiveSessionRoute } from "@/components/library/live-session-route";

export default async function LiveSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string }>;
}) {
  const { folderId } = await searchParams;
  return <LiveSessionRoute folderId={folderId ?? null} />;
}
