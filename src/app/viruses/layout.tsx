import NavbarNoSearch from "@/components/navbars/desktop-navbar";
import Footer from "@/components/footers/footer";

export default function VirusesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavbarNoSearch />
      <main className="grow flex py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}