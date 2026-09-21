import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export default async function ViralToolsServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/services");
  return children;
}
