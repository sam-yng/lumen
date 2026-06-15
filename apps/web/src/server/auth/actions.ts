"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnv } from "@/server/config/env";
import { createServerSupabase } from "@/server/db/client";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const emailSchema = z.object({ email: z.string().email() });
const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signupSchema = loginSchema
  .extend({
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

const verifySignupOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export type AuthState =
  | { error: string; email?: string }
  | { status: "otp-sent"; email: string; error?: string }
  | { status: "check-email" }
  | undefined;

function parseLogin(formData: FormData) {
  return loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseLogin(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect("/library");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabase();
  const { email, password } = parsed.data;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  return { status: "otp-sent", email };
}

export async function verifySignUpOtp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = verifySignupOtpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  });
  if (error) {
    return {
      status: "otp-sent",
      email: parsed.data.email,
      error: error.message,
    };
  }

  redirect("/library");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const supabase = await createServerSupabase();
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  // The recovery link lands on /auth/confirm (type=recovery), which establishes
  // a session, then forwards to /reset-password to set a new password.
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password` },
  );
  if (error) return { error: error.message };
  return { status: "check-email" };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  redirect("/library");
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createServerSupabase();
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/library`,
    },
  });
  if (error) {
    redirect("/login?error=oauth");
  }
  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
