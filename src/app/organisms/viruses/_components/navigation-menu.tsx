"use client";
import { ViewType } from "@/app/organisms/viruses/views";
import { List, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { VerticalMenu } from "@/components/ui/vertical-menu";
import { Button } from "@/components/ui/button";

interface NavigationMenuProps {
  activeView: ViewType;
  handleViewChange: (view: ViewType) => void;
  navCollapsed: boolean;
  onCollapseToggle: () => void;
}

export function NavigationMenu({
  activeView,
  handleViewChange,
  navCollapsed,
  onCollapseToggle
}: NavigationMenuProps) {

  const navItems = [
    {
      icon: <List className="h-4 w-4" />,
      label: "Overview",
      isActive: activeView === "overview",
      onClick: () => handleViewChange("overview")
    },
    {
      icon: <LayoutGrid className="h-4 w-4" />,
      label: "Taxonomy",
      isActive: activeView === "taxonomy",
      onClick: () => handleViewChange("taxonomy")
    },
    {
      icon: <List className="h-4 w-4" />,
      label: "More Options...",
      isActive: activeView === "moreOptions",
      onClick: () => handleViewChange("moreOptions")
    }
    // {
    //   icon: <List className="h-4 w-4" />,
    //   label: "Genomes",
    //   isActive: activeView === "genomes",
    //   onClick: () => setActiveView("genomes")
    // },
    // {
    //   icon: <LayoutGrid className="h-4 w-4" />,
    //   label: "Features",
    //   isActive: activeView === "features",
    //   onClick: () => setActiveView("features")
    // }, {
    //   icon: <List className="h-4 w-4" />,
    //   label: "Proteins",
    //   isActive: activeView === "proteins",
    //   onClick: () => setActiveView("proteins")
    // },
    // {
    //   icon: <LayoutGrid className="h-4 w-4" />,
    //   label: "Protien Structures",
    //   isActive: activeView === "protein-structures",
    //   onClick: () => setActiveView("protein-structures")
    // },
    // {
    //   icon: <List className="h-4 w-4" />,
    //   label: "Domains & Motifs",
    //   isActive: activeView === "domains-motifs",
    //   onClick: () => setActiveView("domains-motifs")
    // },
    // {
    //   icon: <LayoutGrid className="h-4 w-4" />,
    //   label: "Epitopes",
    //   isActive: activeView === "epitopes",
    //   onClick: () => setActiveView("epitopes")
    // },
    // {
    //   icon: <List className="h-4 w-4" />,
    //   label: "Experiments",
    //   isActive: activeView === "experiments",
    //   onClick: () => setActiveView("experiments")
    // }
  ];

  return (
    <nav
      id="view-selector"
      className={`
        overflow-hidden
        transition-[width] duration-300 ease-in-out
        border border-gray-200 bg-background rounded-r-lg
        ${navCollapsed ? "w-[4.5rem]" : "w-64"}
      `}
    >
      <div className="flex items-center justify-between p-4 whitespace-nowrap">
            { !navCollapsed &&
              <h2 className={`font-semibold transition-opacity duration-300`}>
                View Options
              </h2>
            }
            <Button
              onClick={() => onCollapseToggle()}
              className="p-1 hover:bg-gray-200 rounded-lg shrink-0"
              aria-label={navCollapsed ? "Expand menu" : "Collapse menu"}
            >
              {navCollapsed ? (
                <ChevronRight className="shrink-0 w-4 h-4" />
              ) : (
                <ChevronLeft className="shrink-0 w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="px-4 pb-4">
            <VerticalMenu
              items={navItems.map(item => ({
                ...item,
                label: navCollapsed ? "" : item.label
              }))}
              isCollapsed={navCollapsed}
            />
          </div>
    </nav>
  );
}

export default NavigationMenu;