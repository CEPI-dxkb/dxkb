import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TailwindIndicator } from "@/components/ui/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { ThemeSwitcher } from "@/styles/theme-switcher-floating";
import { Providers } from "./providers"; // adjust the path as needed
import { AuthProvider } from "@/contexts/auth-context";
import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/auth/types";
import { TooltipProvider } from "@/components/ui/tooltip";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("bvbrc_user_id")?.value;
  const realm = cookieStore.get("bvbrc_realm")?.value;

  const initialUser: AuthUser | null = userId
    ? { username: userId, email: "", token: "", realm }
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} min-h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-screen">
        <Providers>
          <ThemeProvider>
            <AuthProvider initialUser={initialUser}>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </AuthProvider>
            <ThemeSwitcher />
            <Toaster
              richColors
              position="top-right"
              offset={{ top: "4rem" }}
              duration={3000}
            />
          </ThemeProvider>
          <TailwindIndicator />
        </Providers>
      </body>
    </html>
  );
}
