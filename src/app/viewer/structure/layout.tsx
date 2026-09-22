import Navbar from "@/components/navbars/navbar";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export default async function StructureViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/viewer/structure");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
