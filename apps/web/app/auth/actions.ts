"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string) {
  return redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

function normalizeSiteUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function missingSiteUrlMessage() {
  return "Site URL configuration is required for email redirects.";
}

async function resolveSiteUrl() {
  const configuredSiteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configuredSiteUrl) return configuredSiteUrl;

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const headersList = await headers();
  const origin = normalizeSiteUrl(headersList.get("origin"));
  if (origin) return origin;

  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return (
    normalizeSiteUrl(host ? `${proto}://${host}` : null) ??
    "http://localhost:3000"
  );
}

export async function signIn(formData: FormData) {
  if (!hasSupabaseEnv()) {
    return redirectWithMessage("/", "Supabase configuration is incomplete.");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return redirectWithMessage("/", "Email and password are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirectWithMessage("/", error.message);
  }

  return redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  if (!hasSupabaseEnv()) {
    return redirectWithMessage("/", "Supabase configuration is incomplete.");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return redirectWithMessage("/", "Email and password are required.");
  }
  if (password.length < 8) {
    return redirectWithMessage(
      "/",
      "Password must be at least 8 characters.",
    );
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return redirectWithMessage(
      "/",
      "Password must contain upper, lower, and a digit.",
    );
  }

  const siteUrl = await resolveSiteUrl();
  if (!siteUrl) {
    return redirectWithMessage("/", missingSiteUrlMessage());
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return redirectWithMessage("/", error.message);
  }

  return redirectWithMessage("/", "Check your email for account verification.");
}

export async function signOut() {
  if (!hasSupabaseEnv()) {
    return redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/");
}

export async function signInWithMagicLink(formData: FormData) {
  if (!hasSupabaseEnv()) {
    return redirectWithMessage("/", "Supabase configuration is incomplete.");
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return redirectWithMessage("/", "Email is required for magic link.");
  }

  const siteUrl = await resolveSiteUrl();
  if (!siteUrl) {
    return redirectWithMessage("/", missingSiteUrlMessage());
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return redirectWithMessage("/", error.message);
  }

  return redirectWithMessage("/", "Magic link sent. Check your email.");
}

export async function requestPasswordReset(formData: FormData) {
  if (!hasSupabaseEnv()) {
    return redirectWithMessage(
      "/auth/forgot-password",
      "Supabase configuration is incomplete.",
    );
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return redirectWithMessage("/auth/forgot-password", "Email is required.");
  }

  const siteUrl = await resolveSiteUrl();
  if (!siteUrl) {
    return redirectWithMessage(
      "/auth/forgot-password",
      missingSiteUrlMessage(),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });

  if (error) {
    return redirectWithMessage("/auth/forgot-password", error.message);
  }

  return redirectWithMessage(
    "/auth/forgot-password",
    "Reset link sent. Check your email.",
  );
}

export async function unenrollMfaFactor(formData: FormData) {
  if (!hasSupabaseEnv()) {
    return redirectWithMessage(
      "/dashboard",
      "Supabase configuration is incomplete.",
    );
  }

  const factorId = String(formData.get("factorId") ?? "").trim();
  if (!factorId) {
    return redirectWithMessage("/dashboard", "Missing factor id.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return redirectWithMessage("/dashboard", error.message);
  }

  return redirectWithMessage("/dashboard", "Two-factor disabled.");
}

export async function updatePassword(formData: FormData) {
  if (!hasSupabaseEnv()) {
    return redirectWithMessage(
      "/auth/reset-password",
      "Supabase configuration is incomplete.",
    );
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || password.length < 8) {
    return redirectWithMessage(
      "/auth/reset-password",
      "Password must be at least 8 characters.",
    );
  }
  if (password !== confirm) {
    return redirectWithMessage(
      "/auth/reset-password",
      "Passwords do not match.",
    );
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return redirectWithMessage(
      "/auth/reset-password",
      "Password must contain upper, lower, and a digit.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectWithMessage(
      "/",
      "Reset link expired. Request a new one.",
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return redirectWithMessage("/auth/reset-password", error.message);
  }

  return redirectWithMessage("/", "Password updated. Sign in again.");
}
