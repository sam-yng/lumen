import { redirect } from "next/navigation";

export default function LegacyLivePage(_props: {
  searchParams: Promise<{ folderId?: string }>;
}) {
  redirect("/");
}
