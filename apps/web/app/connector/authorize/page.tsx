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
    <main className="analytics-theme flex flex-1 items-center justify-center bg-page px-4 py-10 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-line bg-paper p-8">
        <p className="text-sm font-medium text-muted">Social Manager App</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Authorize connector
        </h1>

        {!requestId ? (
          <p className="mt-4 text-sm text-danger">
            Missing authorization request. Start the connection from Claude
            again.
          </p>
        ) : !userEmail ? (
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>You need to sign in before authorizing the connector.</p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-ink px-4 py-2.5 font-medium text-paper transition hover:opacity-90"
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
