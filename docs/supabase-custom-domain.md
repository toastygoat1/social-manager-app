# Supabase Custom Domain Setup

This guide explains how to configure a Supabase Custom Domain so the Google OAuth consent screen displays your branded domain (e.g. `auth.yourdomain.com`) instead of the raw Supabase project URL (e.g. `qsdlqbacatrxyhshgnmb.supabase.co`).

> **Prerequisite:** Supabase Pro plan (Custom Domains is a paid feature).

---

## 1. Choose a Subdomain

Pick a subdomain you control. Recommended:

```
auth.yourdomain.com
```

You must own the parent domain (`yourdomain.com`) and have access to its DNS provider (Cloudflare, Route53, Namecheap, etc.).

---

## 2. Register the Custom Domain in Supabase

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Go to **Project Settings → Custom Domains**.
4. Click **Add custom domain**.
5. Enter your chosen subdomain: `auth.yourdomain.com`.
6. Supabase will display a **CNAME target** value. Copy it. It looks similar to:
   ```
   <project-ref>.supabase.co
   ```

Leave this page open — you will return to it after the DNS step.

---

## 3. Create the DNS Record

In your DNS provider's dashboard, create a new record:

| Field   | Value                                           |
| ------- | ----------------------------------------------- |
| Type    | `CNAME`                                         |
| Name    | `auth` (or the full subdomain, depending on UI) |
| Target  | The CNAME target Supabase showed you            |
| TTL     | `Auto` or `300`                                 |
| Proxied | **Disabled** (Cloudflare users: gray cloud)     |

> **Important (Cloudflare):** Disable the orange-cloud proxy for this record. Supabase requires a direct CNAME during verification. You may re-enable proxying later if desired, but only after Supabase confirms the domain is active.

Save the record. DNS propagation usually takes a few minutes but can take up to 48 hours.

---

## 4. Verify the Domain in Supabase

Back in **Project Settings → Custom Domains**:

1. Click **Verify** (or **Activate**).
2. Wait for Supabase to confirm DNS resolution and provision an SSL certificate.
3. Status should change to **Active**.

If verification fails, double-check the CNAME value, ensure Cloudflare proxying is off, and retry after a few minutes.

---

## 5. Update the Google OAuth Client

1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Select the OAuth 2.0 Client ID used by this project.
3. Under **Authorized redirect URIs**:
   - **Add:** `https://auth.yourdomain.com/auth/v1/callback`
   - **Remove:** the old `https://<project-ref>.supabase.co/auth/v1/callback`
4. (Optional but recommended) Under **Authorized JavaScript origins**, add `https://auth.yourdomain.com` and your app origin (e.g. `https://app.yourdomain.com`).
5. Save.

> **Note:** Changes to the OAuth client may take a few minutes to propagate on Google's side.

---

## 6. Update the Supabase Provider Configuration

In the Supabase Dashboard:

1. Go to **Authentication → Providers → Google**.
2. Confirm the **Callback URL (for OAuth)** displayed now uses your custom domain. If a manual override exists, update it to:
   ```
   https://auth.yourdomain.com/auth/v1/callback
   ```
3. Save.

---

## 7. Update Application Environment Variables

Update your `.env.local` (and any deployed environment — Vercel, Docker, etc.) so the client SDK targets the custom domain:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://auth.yourdomain.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<unchanged>
```

The publishable (anon) key does **not** change.

Restart any running dev servers and redeploy production.

---

## 8. Verify the End-to-End Flow

1. Open the app at its public URL.
2. Click **Continue with Google**.
3. On the Google consent screen, the heading should now read:
   ```
   to continue to auth.yourdomain.com
   ```
4. Complete the sign-in and confirm the popup posts back successfully and the parent navigates to `/dashboard`.

---

## Troubleshooting

| Symptom                                                      | Likely Cause                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Consent screen still shows `*.supabase.co`                    | OAuth redirect URI in Google Cloud not updated, or app still loading old `NEXT_PUBLIC_SUPABASE_URL`. |
| `redirect_uri_mismatch` error from Google                    | Custom-domain redirect URI not added in Google Cloud Console.                                    |
| Supabase verification stuck on "Pending"                     | DNS not propagated, or Cloudflare proxy enabled. Disable proxy and wait.                         |
| `Invalid API key` after switching env var                    | Publishable key copied incorrectly. The key itself does not change with the custom domain.       |
| SSL error on `auth.yourdomain.com`                            | Certificate not yet provisioned by Supabase. Wait 5–15 minutes after activation.                 |

---

## Rollback

To revert:

1. Restore `NEXT_PUBLIC_SUPABASE_URL` to the original `https://<project-ref>.supabase.co`.
2. In Google Cloud, re-add the original `*.supabase.co/auth/v1/callback` redirect URI.
3. (Optional) Remove the custom domain in Supabase Dashboard.

Sessions issued under the custom domain remain valid because the JWT signing key is tied to the project, not the hostname.
