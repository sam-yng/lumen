"use client";

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
import { type AuthState, updatePassword } from "@/server/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <Card className="w-full max-w-[360px] border-[var(--border-soft)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
      <CardHeader className="gap-2">
        <CardTitle className="text-[22px] font-semibold leading-tight">
          Set a new password
        </CardTitle>
        <CardDescription className="text-[var(--text-2)]">
          Choose a new password for your account.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="password"
              className="font-mono text-[11.5px] font-medium text-[var(--text-2)]"
            >
              New password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
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
            {pending ? "…" : "Update password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
