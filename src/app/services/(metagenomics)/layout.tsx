import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export default async function MetagenomicsServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/services");
  return children;
}
