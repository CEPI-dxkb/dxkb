import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="grow flex py-8">
        <div className="container max-w-2xl mx-auto">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
