import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/server/auth/actions";

export default function LoginPage() {
  return <AuthForm mode="login" action={signIn} />;
}
