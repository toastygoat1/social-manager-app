import type { User } from "@supabase/supabase-js";

export type UserProfile = {
  avatarUrl: string | null;
  email: string | null;
  name: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function getString(
  values: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getHttpsUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function getUserProfile(user: User): UserProfile {
  const metadata = asRecord(user.user_metadata);
  const googleIdentity =
    user.identities?.find((identity) => identity.provider === "google") ??
    user.identities?.[0];
  const identityData = asRecord(googleIdentity?.identity_data);

  const avatarUrl = getHttpsUrl(
    getString(metadata, ["avatar_url", "picture", "avatar"]) ??
      getString(identityData, ["avatar_url", "picture", "avatar"]),
  );
  const name =
    getString(metadata, ["full_name", "name", "display_name"]) ??
    getString(identityData, ["full_name", "name", "display_name"]);

  return {
    avatarUrl,
    email: user.email ?? null,
    name,
  };
}
