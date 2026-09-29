import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TailwindIndicator } from "@/components/ui/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { AuthBoundary } from "@/lib/auth/provider";
import { getCurrentUser } from "@/lib/auth/server/actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/search/command-palette";
import { UiPreferencesProvider } from "@/lib/ui-preferences/provider";
import { readUiPreferences } from "@/lib/ui-preferences/server";

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
  const [initialUser, initialPreferences] = await Promise.all([
    getCurrentUser(),
    readUiPreferences(),
  ]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} min-h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-screen">
        <Providers>
          <ThemeProvider>
            <AuthBoundary user={initialUser}>
              <UiPreferencesProvider initialPreferences={initialPreferences}>
                <TooltipProvider>
                  {children}
                  {/* Dev-only debug loader: safe to include in dev; no runtime UI */}
                </TooltipProvider>
                <CommandPalette />
              </UiPreferencesProvider>
            </AuthBoundary>
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
