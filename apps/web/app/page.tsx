import Link from "next/link";
import { signIn, signOut, signUp } from "@/app/auth/actions";
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
          Masuk dengan email untuk mengakses dashboard.
        </p>

        {statusMessage ? (
          <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {statusMessage}
          </p>
        ) : null}

        {!hasSupabaseEnv ? (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Konfigurasi Supabase belum lengkap. Tambahkan{" "}
            NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            ke file .env.local.
          </p>
        ) : userEmail ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Login sebagai {userEmail}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Buka dashboard
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
          <form className="mt-6 space-y-4">
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
        )}
      </section>
    </main>
  );
}
