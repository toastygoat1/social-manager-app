import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { APP_THEME_COOKIE, normalizeTheme } from "./theme-preferences";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Manager",
  description: "Social media management dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = normalizeTheme(cookieStore.get(APP_THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
