import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

export default function VirusesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex grow flex-col h-full">{children}</main>
      <Footer />
    </div>
  );
}