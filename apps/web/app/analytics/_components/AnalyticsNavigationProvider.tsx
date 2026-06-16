"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AnalyticsNavigationView = "overview" | "select" | "compare";

export type AnalyticsNavigationTarget = {
  key: string;
  label: string;
  view: AnalyticsNavigationView;
  selectedAccountIds: string[];
  compareAccountIds: [string | null, string | null];
};

type AnalyticsNavigationContextValue = {
  beginNavigation: (target: AnalyticsNavigationTarget) => void;
  pendingTarget: AnalyticsNavigationTarget | null;
};

const AnalyticsNavigationContext =
  createContext<AnalyticsNavigationContextValue | null>(null);

export function AnalyticsNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pendingTarget, setPendingTarget] =
    useState<AnalyticsNavigationTarget | null>(null);

  useEffect(() => {
    if (!pendingTarget) return undefined;

    const timeout = window.setTimeout(() => setPendingTarget(null), 12000);
    return () => window.clearTimeout(timeout);
  }, [pendingTarget]);

  const value = useMemo(
    () => ({
      beginNavigation: setPendingTarget,
      pendingTarget,
    }),
    [pendingTarget],
  );

  return (
    <AnalyticsNavigationContext.Provider value={value}>
      {children}
    </AnalyticsNavigationContext.Provider>
  );
}

export function useAnalyticsNavigation() {
  const context = useContext(AnalyticsNavigationContext);

  if (!context) {
    throw new Error(
      "useAnalyticsNavigation must be used inside AnalyticsNavigationProvider.",
    );
  }

  return context;
}

export function AnalyticsContentShell({ children }: { children: ReactNode }) {
  const { pendingTarget } = useAnalyticsNavigation();

  return (
    <section className="relative">
      <div
        className={`flex flex-col gap-4 transition duration-200 ${
          pendingTarget ? "opacity-55" : "opacity-100"
        }`}
      >
        {children}
      </div>
      {pendingTarget ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end">
          <span className="rounded-full border border-line bg-paper/95 px-3 py-1.5 text-xs font-medium text-muted shadow-[0_10px_30px_rgba(24,22,18,0.12)] backdrop-blur">
            Loading {pendingTarget.label}
          </span>
        </div>
      ) : null}
    </section>
  );
}
