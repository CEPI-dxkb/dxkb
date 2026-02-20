import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TailwindIndicator } from "@/components/ui/tailwind-indicator";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ThemeSwitcher } from "@/styles/theme-switcher-floating";
import { Providers } from "./providers"; // adjust the path as needed
import { AuthProvider } from "@/contexts/auth-context";
import { cookies } from "next/headers";
import type { AuthUser } from "@/app/api/auth/types";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DXKB V2",
  description: "Next-generation Disease X Knowledge Base",
};

function parseUserProfileCookie(rawCookie?: string): {
  first_name?: string;
  last_name?: string;
  email?: string;
  email_verified?: boolean;
  id?: string;
} | null {
  if (!rawCookie) return null;

  try {
    return JSON.parse(rawCookie);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(rawCookie));
    } catch {
      return null;
    }
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawProfile = cookieStore.get("user_profile")?.value;
  const username = cookieStore.get("user_id")?.value;
  const realm = cookieStore.get("realm")?.value;
  const profile = parseUserProfileCookie(rawProfile);
  const initialUser: AuthUser | null =
    profile && username
      ? {
          username,
          email: profile.email ?? "",
          token: "",
          realm,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email_verified: profile.email_verified,
          id: profile.id,
        }
      : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <ThemeProvider defaultTheme="dxkb-light">
            <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
            <ThemeSwitcher />
          </ThemeProvider>
          <Toaster
            richColors
            position="top-right"
            offset={{ top: "4rem" }}
            duration={3000}
          />
          <TailwindIndicator />
        </Providers>
      </body>
    </html>
  );
}
