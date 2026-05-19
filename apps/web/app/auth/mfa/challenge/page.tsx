import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeForm } from "./challenge-form";

export default async function MfaChallengePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Two-factor required
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
        <ChallengeForm />
      </section>
    </main>
  );
}
