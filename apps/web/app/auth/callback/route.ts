import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getRedirectTarget(request: Request, nextPath: string) {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (!isLocalEnv && forwardedHost) {
    return `https://${forwardedHost}${nextPath}`;
  }

  return `${origin}${nextPath}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  let next = searchParams.get("next") ?? "/dashboard";

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.redirect(
      `${origin}/?message=${encodeURIComponent("Konfigurasi Supabase belum lengkap.")}`,
    );
  }

  if (!next.startsWith("/")) {
    next = "/dashboard";
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      return NextResponse.redirect(
        `${origin}/?message=${encodeURIComponent("Tautan verifikasi tidak valid atau kadaluarsa.")}`,
      );
    }

    return NextResponse.redirect(getRedirectTarget(request, next));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/?message=${encodeURIComponent("Tautan verifikasi tidak valid atau kadaluarsa.")}`,
      );
    }

    return NextResponse.redirect(getRedirectTarget(request, next));
  }

  return NextResponse.redirect(
    `${origin}/?message=${encodeURIComponent("Kode verifikasi tidak ditemukan.")}`,
  );
}