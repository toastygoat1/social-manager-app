import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { PasswordField } from "@/app/auth/password-field";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ message?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { message } = await searchParams;
  const status = Array.isArray(message) ? message[0] : message;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/?message=${encodeURIComponent("Open the reset link from your email to continue.")}`,
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Signed in as <span className="font-medium">{user.email}</span>.
        </p>

        {status ? (
          <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {status}
          </p>
        ) : null}

        <form className="mt-6 space-y-4">
          <PasswordField
            name="password"
            label="New password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            showMeter
            required
          />
          <PasswordField
            name="confirm"
            label="Confirm new password"
            placeholder="Repeat password"
            autoComplete="new-password"
            required
          />
          <button
            formAction={updatePassword}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Update password
          </button>
        </form>
      </section>
    </main>
  );
}
