"use client";

import { OAuthSignInButton } from "@/app/auth/oauth-sign-in-button";

export function GoogleSignInButton() {
  return (
    <OAuthSignInButton
      provider="google"
      label="Continue with Google"
      loadingLabel="Opening Google…"
      windowName="googleAuth"
      queryParams={{
        prompt: "select_account",
        access_type: "offline",
      }}
      icon={
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.45c-.24 1.4-1.7 4.1-5.45 4.1-3.28 0-5.96-2.72-5.96-6.05S8.72 6.1 12 6.1c1.87 0 3.12.8 3.83 1.48l2.61-2.5C16.85 3.6 14.62 2.7 12 2.7 6.93 2.7 2.83 6.8 2.83 11.85S6.93 21 12 21c6.93 0 9.16-4.86 9.16-7.4 0-.5-.05-.88-.12-1.4H12z"
          />
        </svg>
      }
    />
  );
}
