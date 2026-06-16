import { AuthForm } from "@/components/auth-form";
import { type AuthState, signIn } from "@/server/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // signInWithGoogle and the OAuth callback both redirect here with
  // ?error=oauth when the provider exchange fails; surface it instead of a
  // silent bounce back to a blank form.
  const initialState: AuthState =
    error === "oauth"
      ? { error: "Google sign-in failed. Try again or use your email." }
      : undefined;
  return <AuthForm mode="login" action={signIn} initialState={initialState} />;
}
