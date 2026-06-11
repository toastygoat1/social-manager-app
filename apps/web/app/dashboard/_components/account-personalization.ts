"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "account-personalization:";
const STORAGE_EVENT = "account-personalization-change";

export type AccountPersonalization = {
  bannerUrl?: string | null;
  accentColor?: string | null;
  nickname?: string | null;
  note?: string | null;
};

const EMPTY: AccountPersonalization = {};

function readFromStorage(accountId: string): AccountPersonalization {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + accountId);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as AccountPersonalization;
    return parsed && typeof parsed === "object" ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeToStorage(accountId: string, value: AccountPersonalization) {
  if (typeof window === "undefined") return;
  const stripped = JSON.stringify(value);
  window.localStorage.setItem(STORAGE_PREFIX + accountId, stripped);
  window.dispatchEvent(
    new CustomEvent(STORAGE_EVENT, { detail: { accountId } }),
  );
}

export function clearPersonalization(accountId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_PREFIX + accountId);
  window.dispatchEvent(
    new CustomEvent(STORAGE_EVENT, { detail: { accountId } }),
  );
}

export function saveAccountPersonalization(
  accountId: string,
  value: AccountPersonalization,
) {
  writeToStorage(accountId, value);
}

export function useAccountPersonalization(accountId: string) {
  const [value, setValue] = useState<AccountPersonalization>(EMPTY);

  useEffect(() => {
    setValue(readFromStorage(accountId));

    function refresh(event: Event) {
      const detail = (event as CustomEvent<{ accountId: string }>).detail;
      if (!detail || detail.accountId === accountId) {
        setValue(readFromStorage(accountId));
      }
    }

    window.addEventListener(STORAGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(STORAGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [accountId]);

  return value;
}
