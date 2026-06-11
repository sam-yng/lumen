import { Suspense } from "react";
import { NoteRoute } from "@/components/library/note-route";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    // NoteRoute reads useSearchParams for document citation block anchors.
    <Suspense>
      <NoteRoute documentId={id} />
    </Suspense>
  );
}
