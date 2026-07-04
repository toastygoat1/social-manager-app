import Link from "next/link";
import { signIn, signOut, signUp } from "@/app/auth/actions";
import { GoogleSignInButton } from "@/app/auth/google-sign-in-button";
import { createClient } from "@/lib/supabase/server";

type HomePageProps = {
  searchParams: Promise<{
    message?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const { message } = await searchParams;
  const statusMessage = Array.isArray(message) ? message[0] : message;

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  let userEmail: string | null = null;

  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    userEmail = user?.email ?? null;
  }

  return (
    <main className="analytics-theme flex flex-1 items-center justify-center bg-page px-4 py-10 text-ink">
      <section className="w-full max-w-xl rounded-2xl border border-line bg-paper p-8">
        <p className="text-sm font-medium text-muted">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Supabase Email Authentication
        </h1>
        <p className="mt-2 text-sm text-muted">Sign in with your email.</p>

        {statusMessage ? (
          <p className="mt-4 rounded-lg border border-line bg-card px-4 py-3 text-sm text-ink">
            {statusMessage}
          </p>
        ) : null}

        {!hasSupabaseEnv ? (
          <p className="mt-6 rounded-lg border border-danger/30 bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg-light))] px-4 py-3 text-sm text-ink">
            Supabase configuration is incomplete. Please add{" "}
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            to your .env.local file.
          </p>
        ) : userEmail ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-success/30 bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-light))] px-4 py-3 text-sm text-ink">
              Sign in as {userEmail}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90"
              >
                Open dashboard
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-card"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <GoogleSignInButton />

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs uppercase tracking-wider text-muted">
                or
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <form className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-ink"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-muted"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-ink"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-muted"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  formAction={signIn}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90"
                >
                  Sign in
                </button>
                <button
                  formAction={signUp}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-card"
                >
                  Sign up
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
