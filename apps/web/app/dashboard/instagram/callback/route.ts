import { createClient } from "@/lib/supabase/server";
import { buildApiUrl } from "@/lib/api/url";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const INSTAGRAM_COMPLETE = "instagram:oauth:complete";

type InstagramOAuthCallbackResponse = {
  connected?: unknown[];
};

type PopupPayload = {
  status: "connected" | "error";
  message?: string;
  count?: number;
};

function getDashboardUrl(request: Request, payload: PopupPayload) {
  const url = new URL("/dashboard", request.url);

  if (payload.status === "connected") {
    url.searchParams.set("instagram", "connected");
    url.searchParams.set("count", String(payload.count ?? 0));
  } else {
    url.searchParams.set("instagram", "error");
    url.searchParams.set(
      "message",
      payload.message ?? "Instagram connection failed.",
    );
  }

  return url.toString();
}

function popupResponse(request: Request, payload: PopupPayload) {
  const origin = new URL(request.url).origin;
  const message = { type: INSTAGRAM_COMPLETE, ...payload };
  const dashboardUrl = getDashboardUrl(request, payload);

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Instagram connection</title>
    <style>
      body {
        align-items: center;
        background: #f5f5f5;
        color: #4c4c4c;
        display: flex;
        font-family: Arial, sans-serif;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <p>Completing Instagram connection...</p>
    <script>
      const message = ${JSON.stringify(message)};
      const targetOrigin = ${JSON.stringify(origin)};
      const dashboardUrl = ${JSON.stringify(dashboardUrl)};

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, targetOrigin);
        setTimeout(() => window.close(), 250);
        setTimeout(() => window.location.replace(dashboardUrl), 1000);
      } else {
        window.location.replace(dashboardUrl);
      }
    </script>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

async function readErrorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = body?.message;

  return Array.isArray(message) ? message[0] : message;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (oauthError) {
    return popupResponse(request, {
      status: "error",
      message: oauthError,
    });
  }

  if (!code || !state) {
    return popupResponse(request, {
      status: "error",
      message: "Instagram did not return a connection code.",
    });
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return popupResponse(request, {
      status: "error",
      message: "Please sign in again before connecting Instagram.",
    });
  }

  const response = await fetch(
    buildApiUrl(API_BASE_URL, "/instagram/oauth/callback"),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, state }),
    },
  );

  if (!response.ok) {
    return popupResponse(request, {
      status: "error",
      message:
        (await readErrorMessage(response)) ?? "Instagram connection failed.",
    });
  }

  const result = (await response
    .json()
    .catch(() => ({}))) as InstagramOAuthCallbackResponse;

  return popupResponse(request, {
    status: "connected",
    count: result.connected?.length ?? 0,
  });
}
