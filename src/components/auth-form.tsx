"use client";

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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
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
        <CardFooter className="mt-4 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "…" : copy.submit}
          </Button>
          <p className="text-sm text-muted-foreground">
            {copy.altPrompt}{" "}
            <Link href={copy.altHref} className="underline">
              {copy.altLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
