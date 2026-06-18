import { redirect } from "next/navigation";

export default function LegacyTranscriptPage(_props: {
  params: Promise<{ recordingId: string }>;
}) {
  redirect("/");
}
