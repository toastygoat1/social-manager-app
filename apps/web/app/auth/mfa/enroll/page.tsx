import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EnrollForm } from "./enroll-form";

export default async function MfaEnrollPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/?message=${encodeURIComponent("Sign in before enabling two-factor.")}`,
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Enable two-factor
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Scan the QR with your authenticator app (Google Authenticator, 1Password,
          Authy, …) then enter the 6-digit code to verify.
        </p>
        <EnrollForm />
      </section>
    </main>
  );
}
