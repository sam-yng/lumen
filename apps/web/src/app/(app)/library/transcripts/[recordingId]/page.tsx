import { Suspense } from "react";
import { TranscriptRoute } from "@/components/library/transcript-route";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const { recordingId } = await params;
  return (
    // TranscriptRoute reads useSearchParams (citation deep links), which
    // requires a Suspense boundary above it.
    <Suspense>
      <TranscriptRoute recordingId={recordingId} />
    </Suspense>
  );
}
