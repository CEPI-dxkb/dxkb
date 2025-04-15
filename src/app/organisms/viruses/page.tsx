"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Views, ViewType } from "./views";
import { Suspense } from "react";
import { NavigationMenuSkeleton } from "@/components/skeletons/viruses/navigation-menu-skeleton";
import { NavigationMenu } from "@/app/organisms/viruses/_components/navigation-menu";

export default function VirusesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = (searchParams?.get("view") as ViewType) ?? "overview";

  const [activeView, setActiveView] = useState<ViewType>(view);
  const [navCollapsed, setNavCollapsed] = useState(false);

  // Update URL when view changes
  const handleViewChange = (newView: ViewType) => {
    setActiveView(newView);
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    params.set("view", newView);
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const ViewComponent = Views[activeView];

  return (
    <div className="flex flex-row flex-1">
      <Suspense fallback={<NavigationMenuSkeleton />}>
        <NavigationMenu
          activeView={activeView}
          handleViewChange={handleViewChange}
          navCollapsed={navCollapsed}
          onCollapseToggle={() => setNavCollapsed(!navCollapsed)}
        />
      </Suspense>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={75}>
          <div id="content-section" className="h-full border border-gray-200 rounded-lg p-4">
            <h1 className="text-3xl font-bold mb-6">All Viruses</h1>
            <ViewComponent />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="w-0 border-none" />

        <ResizablePanel defaultSize={12} maxSize={25}>
          <div id="guide-section" className="h-full border border-gray-200 bg-background-500 rounded-l-lg p-4">
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}