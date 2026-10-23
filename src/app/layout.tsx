import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_STORAGE_KEY, themeBootScript } from "@/lib/theme";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Deal CRM Template: a self-hosted deal pipeline",
  icons: {
    icon: [{ url: "/brand-mark.svg", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get(THEME_STORAGE_KEY)?.value;
  const dark = theme === "dark";
  const boot = themeBootScript(dark);

  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${dark ? "dark" : ""}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
