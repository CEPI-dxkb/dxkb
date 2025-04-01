"use client";

import React from "react";

import Footer from "@/components/footers/footer";
import NewsCarousel from "@/components/ui/news-carousel";
import QuickLinks from "@/components/ui/quick-links";
import Hero from "@/components/ui/hero";
import Navbar from "@/components/navbars/navbar";

export default function Home() {

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="grow">
        <Hero />
        {/* <QuickLinks /> */}
        <NewsCarousel />
      </main>

      <Footer />
    </div>
  );
}