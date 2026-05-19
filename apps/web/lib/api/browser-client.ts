"use client";

import { createClient } from "@/lib/supabase/client";
import { ApiError } from "@/lib/api/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

function buildUrl(path: string) {
  return path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildHeaders(
  auth: boolean,
  callerHeaders: HeadersInit | undefined,
  body: unknown,
  token: string | null,
) {
  const headers = new Headers(callerHeaders);
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

async function readErrorBody(response: Response) {
  return response
    .clone()
    .json()
    .catch(() => response.text().catch(() => null));
}

export async function apiFetchBrowser<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, body, headers: callerHeaders, ...rest } = options;
  const supabase = createClient();

  async function getToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  const url = buildUrl(path);

  async function attempt(token: string | null) {
    return fetch(url, {
      cache: "no-store",
      ...rest,
      headers: buildHeaders(auth, callerHeaders, body, token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const initialToken = auth ? await getToken() : null;
  let response = await attempt(initialToken);

  if (response.status === 401 && auth) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      response = await attempt(data.session.access_token);
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorBody(response));
  }

  return parseResponse<T>(response);
}

export { ApiError };
