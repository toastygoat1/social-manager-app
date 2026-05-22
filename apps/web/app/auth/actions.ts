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

  const headersList = await headers();
  const origin = headersList.get("origin");
  const forwardedHost = headersList.get("x-forwarded-host");
  const forwardedProto = headersList.get("x-forwarded-proto") ?? "https";

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ?? origin ?? "http://localhost:3000";

  if (!siteUrl) {
    return redirectWithMessage("/", "url not found.");
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