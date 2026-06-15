import type { User } from "@supabase/supabase-js";
import {
  BadgeCheck,
  Clock3,
  Globe2,
  KeyRound,
  Link2,
  LogOut,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { signOutCurrentSession, signOutEverywhere } from "@/app/auth/actions";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import type { Account } from "@/app/dashboard/_components/data";
import {
  getAuthSessions,
  trackCurrentAuthSession,
  type AuthSessionRecord,
} from "@/lib/account-sessions";
import { getDashboardData } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile, type UserProfile } from "@/lib/supabase/user-profile";

const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

function getDevBypassUser(): User | null {
  const devUserId = process.env.DEV_USER_ID;
  if (!devUserId || process.env.NODE_ENV === "production") return null;

  return {
    id: devUserId,
    email: process.env.DEV_USER_EMAIL ?? "dev@local",
    user_metadata: {
      full_name: process.env.DEV_USER_NAME ?? "Dev User",
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
  } as User;
}

function getInitials(label: string | null | undefined, fallback = "G") {
  const cleanLabel = label?.replace(/^@/, "").split("@")[0].trim();
  if (!cleanLabel) return fallback;

  const parts = cleanLabel.split(/[\s._-]+/).filter(Boolean);
  const initials =
    parts.length > 1
      ? parts
          .slice(0, 2)
          .map((part) => part.charAt(0))
          .join("")
      : cleanLabel.slice(0, 2);

  return initials.toUpperCase();
}

function getProfileName(profile: UserProfile) {
  return profile.name?.trim() || profile.email?.split("@")[0] || "Growth";
}

function getProfileDetail(profile: UserProfile) {
  return profile.email ?? "Workspace owner";
}

function getProviderLabel(provider: string) {
  const normalized = provider.toLowerCase();

  if (normalized === "google") return "Google";
  if (normalized === "email") return "Email and password";
  if (normalized === "github") return "GitHub";

  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function getProviderList(profile: UserProfile) {
  const providers = profile.providers.length ? profile.providers : ["email"];
  return providers.map(getProviderLabel);
}

function formatDate(value: string | number | null | undefined) {
  if (!value) return "Not available";

  const date =
    typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return DATE_FORMATTER.format(date);
}

function getBrowserName(userAgent: string | null) {
  if (!userAgent) return "Unknown browser";

  if (userAgent.includes("Edg/")) return "Microsoft Edge";
  if (userAgent.includes("Chrome/")) return "Chrome";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Safari/")) return "Safari";

  return "Browser";
}

function getOperatingSystem(userAgent: string | null) {
  if (!userAgent) return "unknown device";

  if (userAgent.includes("Mac OS X")) return "macOS";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    return "iOS";
  }
  if (userAgent.includes("Linux")) return "Linux";

  return "device";
}

function getRequestIp(headersList: { get(name: string): string | null }) {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;

  return (
    headersList.get("x-real-ip") ??
    headersList.get("cf-connecting-ip") ??
    null
  );
}

function maskIpAddress(ip: string | null) {
  if (!ip) return "Not available";

  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts.slice(0, 3).join(".")}.*`;
  }

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    if (parts.length > 2) return `${parts.slice(0, 2).join(":")}:...`;
  }

  return ip;
}

function getAccountTitle(account: Account) {
  return account.displayName?.trim() || account.name.replace(/^@/, "").trim();
}

async function getAccountsForPage(shouldFetch: boolean) {
  if (!shouldFetch) return [];

  try {
    const data = await getDashboardData();
    return data.accounts;
  } catch {
    return [];
  }
}

async function getTrackedSessions(input: {
  shouldFetch: boolean;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  if (!input.shouldFetch) return [];

  try {
    await trackCurrentAuthSession({
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
    const response = await getAuthSessions();
    return response.sessions;
  } catch {
    return [];
  }
}

function getSessionDevice(session: AuthSessionRecord) {
  const browser = session.browser ?? "Unknown browser";
  const operatingSystem = session.operatingSystem ?? "unknown device";

  return `${browser} on ${operatingSystem}`;
}

function getSessionStatus(session: AuthSessionRecord) {
  if (session.signedOutAt) return "Signed out";
  if (session.isCurrent) return "Current";
  return "Active";
}

function getSessionExpiresAt(session: AuthSessionRecord) {
  if (session.signedOutAt) return formatDate(session.signedOutAt);
  return session.expiresAt ? formatDate(session.expiresAt) : "Not available";
}

function InfoCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-paper p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-ink">
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="dashboard-ui-meta font-normal text-muted">{label}</p>
          <p className="dashboard-card-title mt-1 truncate text-[18px] text-ink">
            {value}
          </p>
          <p className="dashboard-ui-meta mt-2 font-normal leading-relaxed text-muted">
            {detail}
          </p>
        </div>
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <span className="dashboard-ui-label text-muted">{label}</span>
      <span className="dashboard-ui-label min-w-0 truncate text-right text-ink">
        {value}
      </span>
    </div>
  );
}

function AccountAvatar({ account, index }: { account: Account; index: number }) {
  const colors = ["#4f6f8f", "#3daeb8", "#b57ba6", "#d4a04b"];
  const color = colors[index % colors.length];

  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      <AvatarImage
        src={account.avatarUrl}
        alt={account.name}
        width={40}
        height={40}
        className="size-full object-cover"
        fallback={getInitials(account.name, "I")}
      />
    </span>
  );
}

export default async function AccountPage() {
  const supabaseConfigured = hasSupabaseEnv();
  const devBypassUser = getDevBypassUser();

  if (!supabaseConfigured && !devBypassUser) {
    redirect("/?message=" + encodeURIComponent("no env variable"));
  }

  let user = devBypassUser;
  let sessionExpiresAt: number | null = null;

  if (!user) {
    const supabase = await createClient();
    const userResult = await supabase.auth.getUser();

    if (userResult.error || !userResult.data.user) {
      redirect("/");
    }

    const sessionResult = await supabase.auth.getSession();
    user = userResult.data.user;
    sessionExpiresAt = sessionResult.data.session?.expires_at ?? null;
  }

  const headersList = await headers();
  const profile = getUserProfile(user);
  const profileName = getProfileName(profile);
  const profileDetail = getProfileDetail(profile);
  const providers = getProviderList(profile);
  const userAgent = headersList.get("user-agent");
  const browserName = getBrowserName(userAgent);
  const operatingSystem = getOperatingSystem(userAgent);
  const requestIp = getRequestIp(headersList);
  const maskedRequestIp = maskIpAddress(requestIp);
  const signedInAt = formatDate(user.last_sign_in_at ?? user.created_at);
  const sessionExpiry = devBypassUser
    ? "Development bypass"
    : formatDate(sessionExpiresAt);
  const fallbackCurrentSession: AuthSessionRecord = {
    id: "current",
    browser: browserName,
    operatingSystem,
    ipAddressMasked: maskedRequestIp,
    firstSeenAt: user.last_sign_in_at ?? user.created_at,
    lastSeenAt: new Date().toISOString(),
    expiresAt:
      devBypassUser || !sessionExpiresAt
        ? null
        : new Date(sessionExpiresAt * 1000).toISOString(),
    signedOutAt: null,
    isCurrent: true,
    status: "active",
  };
  const [accounts, trackedSessions] = await Promise.all([
    getAccountsForPage(supabaseConfigured),
    getTrackedSessions({
      shouldFetch: supabaseConfigured,
      userAgent,
      ipAddress: requestIp,
    }),
  ]);
  const sessions =
    trackedSessions.length > 0 ? trackedSessions : [fallbackCurrentSession];
  const currentSession =
    sessions.find((session) => session.isCurrent) ?? fallbackCurrentSession;
  const activeSessionCount = sessions.filter(
    (session) => session.status === "active",
  ).length;

  return (
    <div className="app-shell-frame flex min-h-screen items-start gap-[2px] p-1 font-sans text-ink transition-colors duration-500">
      <Sidebar active="account" accounts={accounts} profile={profile} />
      <main className="analytics-theme app-shell-panel min-w-0 flex-1 overflow-y-auto bg-paper font-inter text-ink">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-5 py-8 sm:px-7 sm:py-9">
          <header className="rounded-lg border border-line bg-paper p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#5e6ad2] text-lg font-semibold text-white">
                  <AvatarImage
                    src={profile.avatarUrl}
                    alt={`${profileName} profile picture`}
                    width={64}
                    height={64}
                    className="size-full object-cover"
                    fallback={getInitials(profileName)}
                  />
                </span>
                <div className="min-w-0">
                  <p className="dashboard-ui-label text-muted">Account</p>
                  <h1 className="dashboard-page-title mt-1 text-[44px] leading-none text-ink sm:text-[56px]">
                    {profileName}
                  </h1>
                  <p className="dashboard-section-subtitle mt-3 truncate text-muted">
                    {profileDetail}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <form action={signOutCurrentSession}>
                  <button
                    type="submit"
                    className="dashboard-ui-label flex h-10 items-center gap-2 rounded-lg border border-line bg-paper px-4 text-ink transition hover:bg-card"
                  >
                    <LogOut className="size-4" strokeWidth={1.8} />
                    Sign out here
                  </button>
                </form>
                <form action={signOutEverywhere}>
                  <button
                    type="submit"
                    className="dashboard-ui-label flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-paper transition hover:opacity-85"
                  >
                    <ShieldCheck className="size-4" strokeWidth={1.8} />
                    Sign out everywhere
                  </button>
                </form>
              </div>
            </div>
          </header>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              icon={BadgeCheck}
              label="Login method"
              value={providers.join(", ")}
              detail="Providers linked to this Social Manager web account."
            />
            <InfoCard
              icon={Monitor}
              label="Current session"
              value={getSessionDevice(currentSession)}
              detail="This is the browser session making the current request."
            />
            <InfoCard
              icon={Link2}
              label="Connected accounts"
              value={`${accounts.length} Instagram`}
              detail="Active social accounts available in the dashboard sidebar."
            />
            <InfoCard
              icon={Clock3}
              label="Known sessions"
              value={`${activeSessionCount} active`}
              detail={`${sessions.length} browser session${
                sessions.length === 1 ? "" : "s"
              } recorded for this account.`}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.62fr)]">
            <section className="rounded-lg border border-line bg-paper p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="dashboard-ui-label text-muted">Security</p>
                  <h2 className="dashboard-card-title mt-1 text-ink">
                    Where you are logged in
                  </h2>
                </div>
                <span className="grid size-9 place-items-center rounded-lg bg-card text-ink">
                  <Globe2 className="size-4" strokeWidth={1.8} />
                </span>
              </div>

              <div className="mt-5">
                <DetailRow
                  label="Current browser"
                  value={getSessionDevice(currentSession)}
                />
                <DetailRow
                  label="Approximate source"
                  value={currentSession.ipAddressMasked ?? "Not available"}
                />
                <DetailRow label="Signed in" value={signedInAt} />
                <DetailRow label="Current session expiry" value={sessionExpiry} />
                <DetailRow label="User ID" value={user.id} />
              </div>

              <div className="mt-5 rounded-lg border border-line">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 border-b border-line p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="dashboard-ui-label text-ink">
                          {getSessionDevice(session)}
                        </p>
                        <span
                          className={`dashboard-ui-meta rounded-full px-2 py-0.5 font-normal ${
                            session.signedOutAt
                              ? "bg-card text-muted"
                              : session.isCurrent
                                ? "bg-ink text-paper"
                                : "bg-card text-muted"
                          }`}
                        >
                          {getSessionStatus(session)}
                        </span>
                      </div>
                      <p className="dashboard-ui-meta mt-1 font-normal text-muted">
                        Last active {formatDate(session.lastSeenAt)}
                        {session.ipAddressMasked
                          ? ` from ${session.ipAddressMasked}`
                          : ""}
                      </p>
                    </div>
                    <div className="dashboard-ui-meta shrink-0 font-normal text-muted">
                      {session.signedOutAt ? "Signed out" : "Expires"}{" "}
                      {getSessionExpiresAt(session)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-paper p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="dashboard-ui-label text-muted">Login methods</p>
                  <h2 className="dashboard-card-title mt-1 text-ink">
                    Connected sign-in providers
                  </h2>
                </div>
                <span className="grid size-9 place-items-center rounded-lg bg-card text-ink">
                  <KeyRound className="size-4" strokeWidth={1.8} />
                </span>
              </div>

              <div className="mt-5 grid gap-2">
                {providers.map((provider) => (
                  <div
                    key={provider}
                    className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
                  >
                    <span className="dashboard-ui-label text-ink">
                      {provider}
                    </span>
                    <span className="dashboard-ui-meta rounded-full bg-card px-2.5 py-1 font-normal text-muted">
                      Linked
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-line bg-paper p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="dashboard-ui-label text-muted">
                  Social access
                </p>
                <h2 className="dashboard-card-title mt-1 text-ink">
                  Connected Instagram accounts
                </h2>
              </div>
              <span className="dashboard-ui-meta rounded-full bg-card px-3 py-1.5 font-normal text-muted">
                {accounts.length} active
              </span>
            </div>

            {accounts.length > 0 ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {accounts.map((account, index) => (
                  <div
                    key={account.id}
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-line p-3"
                  >
                    <AccountAvatar account={account} index={index} />
                    <div className="min-w-0">
                      <p className="dashboard-ui-label truncate text-ink">
                        {getAccountTitle(account)}
                      </p>
                      <p className="dashboard-ui-meta mt-0.5 truncate font-normal text-muted">
                        @{account.username ?? account.name.replace(/^@/, "")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-ui-meta mt-5 rounded-lg border border-dashed border-line p-4 font-normal leading-relaxed text-muted">
                No Instagram accounts are connected yet.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
