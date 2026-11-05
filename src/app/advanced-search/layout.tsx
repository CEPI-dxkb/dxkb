import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

export default function AdvancedSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="service-surface flex grow py-8">
        <div className="service-container container">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
