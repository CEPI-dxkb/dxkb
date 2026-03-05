import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";
import { Suspense } from "react";

export default function VirusesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </main>
      <Footer />
    </div>
  );
}