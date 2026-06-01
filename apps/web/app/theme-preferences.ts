export const APP_THEME_COOKIE = "snowflake-theme";
export const APP_THEME_EVENT = "snowflake-theme-change";
export const APP_THEME_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemeMode = "light" | "dark";

export function normalizeTheme(value: string | undefined | null): ThemeMode {
  return value === "dark" ? "dark" : "light";
}
