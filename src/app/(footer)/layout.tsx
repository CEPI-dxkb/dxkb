import NavbarNoSearch from "@/components/navbars/old-navbar-no-search";
import Footer from "@/components/footers/footer";

export default function VirusesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavbarNoSearch />
      <main className="flex grow flex-col">{children}</main>
      <Footer />
    </div>
  );
}
