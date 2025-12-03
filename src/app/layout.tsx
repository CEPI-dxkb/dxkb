import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TailwindIndicator } from "@/components/ui/tailwind-indicator";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ThemeSwitcher } from "@/styles/theme-switcher-floating";
import { Providers } from './providers' // adjust the path as needed
import { AuthProvider } from "@/contexts/auth-context";
import { ReactScan } from "@/components/react-scan";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* <script src="https://unpkg.com/react-scan/dist/auto.global.js" /> */}
      </head>

      {/* <ReactScan /> */}

      <body>
      <Providers>
        <ThemeProvider defaultTheme="dxkb-light">
          <AuthProvider>
            {children}
          </AuthProvider>
          <ThemeSwitcher />
        </ThemeProvider>
        <Toaster richColors position="top-right" offset={{top: "4rem"}} duration={3000}/>
        <TailwindIndicator />
      </Providers>
      </body>
    </html>
  );
}
