"use client";

import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

interface ServiceLayoutProps {
  children: React.ReactNode;
}

export default function ServicesLayout({
  children,
}: ServiceLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="grow flex py-8">
        <div className="service-container container">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}