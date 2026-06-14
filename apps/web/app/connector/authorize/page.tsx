import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConsentForm } from "./consent-form";

type AuthorizePageProps = {
  searchParams: Promise<{ request_id?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConnectorAuthorizePage({
  searchParams,
}: AuthorizePageProps) {
  const { request_id } = await searchParams;
  const requestId = firstParam(request_id);

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

  const devBypass =
    !userEmail &&
    process.env.NODE_ENV !== "production" &&
    Boolean(process.env.DEV_USER_ID);
  if (devBypass) {
    userEmail = process.env.DEV_USER_EMAIL ?? "dev@local";
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-[#fafafa] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Authorize connector
        </h1>

        {!requestId ? (
          <p className="mt-4 text-sm text-red-700">
            Missing authorization request. Start the connection from Claude
            again.
          </p>
        ) : !userEmail ? (
          <div className="mt-4 space-y-3 text-sm text-zinc-600">
            <p>You need to sign in before authorizing the connector.</p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-800"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <ConsentForm requestId={requestId} userEmail={userEmail} />
          </div>
        )}
      </section>
    </main>
  );
}
