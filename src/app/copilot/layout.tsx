import type { Metadata } from "next";
import Navbar from "@/components/navbars/navbar";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export const metadata: Metadata = {
  title: "Copilot | DXKB",
};

export default async function CopilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/copilot");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
