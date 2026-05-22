import Link from "next/link";
import { redirect } from "next/navigation";
import { unenrollMfaFactor } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ message?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const { message } = await searchParams;
  const status = Array.isArray(message) ? message[0] : message;

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

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

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    redirect("/auth/mfa/challenge");
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];

  return (
    <section className="bg-stone-50 p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="max-w-5xl">
        <p className="text-sm font-medium text-emerald-700">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">
          Account Overview
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You have successfully logged in.
        </p>

        {status ? (
          <p className="mt-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {status}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Signed in user</p>
            <p className="mt-2 font-semibold text-slate-950">{user.email}</p>
            <p className="mt-2 break-all text-xs text-slate-500">
              User ID: {user.id}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Two-factor (TOTP)
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {totp ? "Enabled" : "Disabled"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Assurance level: {aal?.currentLevel ?? "unknown"}
                </p>
              </div>
              {totp ? (
                <form action={unenrollMfaFactor}>
                  <input type="hidden" name="factorId" value={totp.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Disable 2FA
                  </button>
                </form>
              ) : (
                <Link
                  href="/auth/mfa/enroll"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  Enable 2FA
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/messages"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Open messages
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Homepage
          </Link>
        </div>
      </div>
    </section>
  );
}
