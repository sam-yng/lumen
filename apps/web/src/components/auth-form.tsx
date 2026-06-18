"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LumenMark } from "@/components/lumen-mark";
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
import {
  type AuthState,
  resendSignUpOtp,
  signInWithGoogle,
  verifySignUpOtp,
} from "@/server/auth/actions";

type AuthAction = (prev: AuthState, formData: FormData) => Promise<AuthState>;

type AuthFormProps = {
  mode: "login" | "signup";
  action: AuthAction;
  initialState?: AuthState;
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

function isOtpSentState(state: AuthState): state is {
  status: "otp-sent";
  email: string;
  error?: string;
  resent?: boolean;
} {
  return Boolean(state && "status" in state && state.status === "otp-sent");
}

function errorOf(state: AuthState): string | undefined {
  return state && "error" in state ? state.error : undefined;
}

export function AuthForm({ mode, action, initialState }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    initialState,
  );
  const [otpState, otpFormAction, otpPending] = useActionState<
    AuthState,
    FormData
  >(verifySignUpOtp, undefined);
  const [resendState, resendFormAction, resendPending] = useActionState<
    AuthState,
    FormData
  >(resendSignUpOtp, undefined);
  const copy = COPY[mode];
  const otpBase = isOtpSentState(otpState)
    ? otpState
    : isOtpSentState(resendState)
      ? resendState
      : isOtpSentState(state)
        ? state
        : undefined;
  const resent = isOtpSentState(resendState) && resendState.resent === true;
  const pendingOtpState = otpBase
    ? {
        ...otpBase,
        error: errorOf(otpState) ?? errorOf(resendState) ?? errorOf(state),
        resent,
      }
    : undefined;

  if (pendingOtpState) {
    return (
      <Card
        key="otp"
        className="w-full max-w-[360px] border-border-soft bg-surface shadow-(--shadow-pop)"
      >
        <CardHeader className="gap-2">
          <LumenMark className="mb-1 size-10 min-[860px]:hidden" />
          <CardTitle className="text-[22px] font-semibold leading-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-text-2">
            Enter the confirmation code from your inbox.
          </CardDescription>
        </CardHeader>
        <form action={otpFormAction}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="email"
                className="font-mono text-[11.5px] font-medium text-text-2"
              >
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={pendingOtpState.email}
                readOnly
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="token"
                className="font-mono text-[11.5px] font-medium text-text-2"
              >
                Confirmation code
              </Label>
              <Input
                id="token"
                name="token"
                inputMode="numeric"
                maxLength={10}
                pattern="[0-9]{6,10}"
                required
              />
            </div>
            {pendingOtpState.error ? (
              <p className="text-sm text-destructive" role="alert">
                {pendingOtpState.error}
              </p>
            ) : pendingOtpState.resent ? (
              <output className="text-sm text-text-3">
                New code sent to your email.
              </output>
            ) : null}
          </CardContent>
          <CardFooter className="mt-4 flex flex-col gap-3 border-0 bg-transparent pt-0">
            <Button type="submit" className="w-full" disabled={otpPending}>
              {otpPending ? "…" : "Verify email"}
            </Button>
          </CardFooter>
        </form>
        <form
          action={resendFormAction}
          className="flex flex-col gap-2 px-6 pb-6 text-center"
        >
          <input type="hidden" name="email" value={pendingOtpState.email} />
          <p className="text-sm text-text-3">
            Didn’t get a code?{" "}
            <Button
              type="submit"
              variant="link"
              className="h-auto p-0 font-medium text-accent-text"
              disabled={resendPending}
            >
              {resendPending ? "Sending…" : "Resend code"}
            </Button>
          </p>
        </form>
      </Card>
    );
  }

  return (
    <Card
      key="credentials"
      className="w-full max-w-[360px] border-border-soft bg-surface shadow-(--shadow-pop)"
    >
      <CardHeader className="gap-2">
        <LumenMark className="mb-1 size-10 min-[860px]:hidden" />
        <CardTitle className="text-[22px] font-semibold leading-tight">
          {copy.title}
        </CardTitle>
        <CardDescription className="text-text-2">
          {copy.description}
        </CardDescription>
      </CardHeader>
      {/* Sibling form (not nested) so the OAuth submit is valid HTML. */}
      <form action={signInWithGoogle} className="flex flex-col gap-3 px-6">
        <Button type="submit" variant="outline" className="w-full">
          Continue with Google
        </Button>
        <div className="flex w-full items-center gap-3 text-xs text-text-4">
          <span className="h-px flex-1 bg-border-soft" />
          <span>or</span>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
      </form>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="email"
              className="font-mono text-[11.5px] font-medium text-text-2"
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
              className="font-mono text-[11.5px] font-medium text-text-2"
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
          {mode === "signup" ? (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="confirmPassword"
                className="font-mono text-[11.5px] font-medium text-text-2"
              >
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
          ) : null}
          {errorOf(state) ? (
            <p className="text-sm text-destructive" role="alert">
              {errorOf(state)}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3 border-0 bg-transparent pt-0">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "…" : copy.submit}
          </Button>
          {mode === "login" ? (
            <p className="text-sm text-text-3">
              <Link
                href="/forgot-password"
                className="font-medium text-accent-text underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          ) : null}
          <p className="text-sm text-text-3">
            {copy.altPrompt}{" "}
            <Link
              href={copy.altHref}
              className="font-medium text-accent-text underline-offset-4 hover:underline"
            >
              {copy.altLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
