"use client";

import React from "react";

import Footer from "@/components/footers/footer";
import NewsCarousel from "@/components/ui/news-carousel";
import WelcomeSearch from "@/components/search/welcome-search";
import QuickLinks from "@/components/ui/quick-links";
import WelcomeHero from "@/components/heros/welcome-hero";
import Navbar from "@/components/navbars/navbar";
import QuickViralLinks from "@/components/quick-links/quick-viral";
import ResearchUpdates from "@/components/research/research-updates";
import DBStatistics from "@/components/statistics/db-statistics";

export default function Home() {

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="grow">
        {/* <WelcomeHero /> */}
        {/* <QuickLinks /> */}
        <WelcomeSearch />
        <QuickViralLinks />
        <NewsCarousel />
        <DBStatistics />
        <ResearchUpdates />
      </main>

      <Footer />
    </div>
  );
}