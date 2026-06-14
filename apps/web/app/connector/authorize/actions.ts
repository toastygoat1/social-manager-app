"use server";

import { getAccessToken } from "@/lib/supabase/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ConsentResult = { redirectTo: string } | { error: string };

async function postConsent(
  requestId: string,
  approve: boolean,
): Promise<ConsentResult> {
  const supabaseAccessToken = await getAccessToken();

  const response = await fetch(`${API_BASE_URL}/oauth/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, supabaseAccessToken, approve }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    return { error: detail || "Authorization failed" };
  }

  return (await response.json()) as { redirectTo: string };
}

export async function approveConnector(requestId: string) {
  return postConsent(requestId, true);
}

export async function denyConnector(requestId: string) {
  return postConsent(requestId, false);
}
