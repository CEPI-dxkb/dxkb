import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="container grow py-8">{children}</main>
      <Footer />
    </div>
  );
}
