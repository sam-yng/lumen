import { SettingsKeyForm } from "@/app/(app)/settings/settings-key-form";
import { getRouteServiceContext } from "@/app/api/library/http";
import { hasApiKey } from "@/server/services/ai-credentials";

export default async function SettingsPage() {
  const ctx = await getRouteServiceContext();
  const keySet = ctx ? await hasApiKey(ctx) : false;

  return (
    <div className="mx-auto w-full max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="mt-8">
        <h2 className="text-lg font-medium">Claude API key</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The assistant uses your own Anthropic API key. Inference is billed to
          your account. Your key is encrypted at rest and never shown again.
        </p>
        <SettingsKeyForm initialKeySet={keySet} />
      </section>
    </div>
  );
}
