import Navbar from "@/components/navbars/navbar";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export default async function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/jobs");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
