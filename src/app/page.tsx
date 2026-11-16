import { Suspense } from "react";

import Footer from "@/components/footers/footer";
import NewsCarousel from "@/components/ui/news-carousel";
import WelcomeSearch from "@/components/search/welcome-search";
import Navbar from "@/components/navbars/navbar";
import QuickViralLinks from "@/components/quick-links/quick-viral";
import QuickViralSkeleton from "@/components/quick-links/quick-viral-skeleton";
import ResearchUpdates from "@/components/research/research-updates";
import DBStatistics from "@/components/statistics/db-statistics";
import DBStatisticsSkeleton from "@/components/statistics/db-statistics-skeleton";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="grow bg-background">
        <WelcomeSearch />
        <NewsCarousel />
        <Suspense fallback={<QuickViralSkeleton />}>
          <QuickViralLinks />
        </Suspense>
        <Suspense fallback={<DBStatisticsSkeleton />}>
          <DBStatistics />
        </Suspense>
        <ResearchUpdates />
      </main>

      <Footer />
    </div>
  );
}
