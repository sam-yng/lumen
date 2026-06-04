"use client";

import { Code2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/server/auth/actions";

type AuthAction = (prev: AuthState, formData: FormData) => Promise<AuthState>;

type AuthFormProps = {
  mode: "login" | "signup";
  action: AuthAction;
};

const COPY = {
  login: {
    title: "Log in",
    description: "Welcome back to Lumen.",
    submit: "Log in",
    altPrompt: "Need an account?",
    altHref: "/signup",
    altLabel: "Sign up",
  },
  signup: {
    title: "Sign up",
    description: "Create your Lumen workspace.",
    submit: "Sign up",
    altPrompt: "Already have an account?",
    altHref: "/login",
    altLabel: "Log in",
  },
} as const;

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );
  const copy = COPY[mode];

  return (
    <Card className="w-full max-w-[360px] border-[var(--border-soft)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
      <CardHeader className="gap-2">
        <CardTitle className="text-[22px] font-semibold leading-tight">
          {copy.title}
        </CardTitle>
        <CardDescription className="text-[var(--text-2)]">
          {copy.description}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="email"
              className="font-mono text-[11.5px] font-medium text-[var(--text-2)]"
            >
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="password"
              className="font-mono text-[11.5px] font-medium text-[var(--text-2)]"
            >
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
          </div>
          {state?.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3 border-0 bg-transparent pt-0">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "…" : copy.submit}
          </Button>
          <div className="flex w-full items-center gap-3 text-xs text-[var(--text-4)]">
            <span className="h-px flex-1 bg-[var(--border-soft)]" />
            <span>or</span>
            <span className="h-px flex-1 bg-[var(--border-soft)]" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled
            title="GitHub authentication is not enabled in v1."
          >
            <Code2 className="size-4" />
            Continue with GitHub
          </Button>
          <p className="text-sm text-[var(--text-3)]">
            {copy.altPrompt}{" "}
            <Link
              href={copy.altHref}
              className="font-medium text-[var(--accent-text)] underline-offset-4 hover:underline"
            >
              {copy.altLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
