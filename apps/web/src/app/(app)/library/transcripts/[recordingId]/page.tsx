import { TranscriptRoute } from "@/components/library/transcript-route";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const { recordingId } = await params;
  return <TranscriptRoute recordingId={recordingId} />;
}
