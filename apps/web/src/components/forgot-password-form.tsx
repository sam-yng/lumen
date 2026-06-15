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
import { type AuthState, requestPasswordReset } from "@/server/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    undefined,
  );

  if (state && "status" in state && state.status === "check-email") {
    return (
      <Card className="w-full max-w-[360px] border-[var(--border-soft)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
        <CardHeader className="gap-2">
          <CardTitle className="text-[22px] font-semibold leading-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-[var(--text-2)]">
            If that address has an account, a reset link is on its way.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[360px] border-[var(--border-soft)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
      <CardHeader className="gap-2">
        <CardTitle className="text-[22px] font-semibold leading-tight">
          Reset password
        </CardTitle>
        <CardDescription className="text-[var(--text-2)]">
          We'll email you a reset link.
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
          {state && "error" in state && state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3 border-0 bg-transparent pt-0">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "…" : "Send reset link"}
          </Button>
          <p className="text-sm text-[var(--text-3)]">
            <Link
              href="/login"
              className="font-medium text-[var(--accent-text)] underline-offset-4 hover:underline"
            >
              Back to log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
