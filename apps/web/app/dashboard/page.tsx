import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )

  if (!hasSupabaseEnv) {
    redirect("/?message=" + encodeURIComponent("no env variable"));
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-900 p-6 text-zinc-100">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-800 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold">Authenticated Session</h1>
        <p className="mt-3 text-zinc-300">
          Kamu berhasil login dengan Supabase Auth menggunakan email.
        </p>

        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">Signed in user</p>
          <p className="mt-1 font-medium text-zinc-100">{user.email}</p>
          <p className="mt-2 text-xs text-zinc-500">User ID: {user.id}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
          >
            Kembali ke beranda
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}