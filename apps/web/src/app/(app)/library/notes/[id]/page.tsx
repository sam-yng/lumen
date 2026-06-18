import { redirect } from "next/navigation";

export default function LegacyNotePage(_props: {
  params: Promise<{ id: string }>;
}) {
  redirect("/");
}
