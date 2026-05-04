import Link from "next/link";
import { signIn, signInWithGoogle, signOut, signUp } from "@/app/auth/actions";
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
    <main className="flex flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Supabase Email Authentication
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with your email.
        </p>

        {statusMessage ? (
          <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {statusMessage}
          </p>
        ) : null}

        {!hasSupabaseEnv ? (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Supabase configuration is incomplete. Please add{" "}
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            to your .env.local file.
          </p>
        ) : userEmail ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Sign in as {userEmail}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Open dashboard
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                >
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.45c-.24 1.4-1.7 4.1-5.45 4.1-3.28 0-5.96-2.72-5.96-6.05S8.72 6.1 12 6.1c1.87 0 3.12.8 3.83 1.48l2.61-2.5C16.85 3.6 14.62 2.7 12 2.7 6.93 2.7 2.83 6.8 2.83 11.85S6.93 21 12 21c6.93 0 9.16-4.86 9.16-7.4 0-.5-.05-.88-.12-1.4H12z"
                  />
                </svg>
                Continue with Google
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-xs uppercase tracking-wider text-zinc-400">
                or
              </span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

            <form className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-zinc-700"
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
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                formAction={signIn}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Sign in
              </button>
              <button
                formAction={signUp}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
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
