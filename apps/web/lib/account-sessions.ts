import { apiFetch } from "@/lib/api/client";

export type AuthSessionStatus = "active" | "signed_out";

export type AuthSessionRecord = {
  id: string;
  browser: string | null;
  operatingSystem: string | null;
  ipAddressMasked: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  signedOutAt: string | null;
  isCurrent: boolean;
  status: AuthSessionStatus;
};

export type AuthSessionsResponse = {
  sessions: AuthSessionRecord[];
};

export async function trackCurrentAuthSession(input: {
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  return apiFetch<AuthSessionRecord>("/auth/sessions/current", {
    method: "POST",
    body: {
      userAgent: input.userAgent ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}

export async function getAuthSessions() {
  return apiFetch<AuthSessionsResponse>("/auth/sessions");
}

export async function markCurrentAuthSessionSignedOut() {
  return apiFetch<{ signedOutAt: string }>("/auth/sessions/current/sign-out", {
    method: "POST",
  });
}

export async function markAllAuthSessionsSignedOut() {
  return apiFetch<{ signedOutAt: string }>("/auth/sessions/sign-out", {
    method: "POST",
  });
}
