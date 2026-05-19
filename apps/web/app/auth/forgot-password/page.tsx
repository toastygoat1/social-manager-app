import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";

type Props = {
  searchParams: Promise<{ message?: string | string[] }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { message } = await searchParams;
  const status = Array.isArray(message) ? message[0] : message;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enter your email. We&apos;ll send a link to set a new password.
        </p>

        {status ? (
          <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {status}
          </p>
        ) : null}

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
          <button
            formAction={requestPasswordReset}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
