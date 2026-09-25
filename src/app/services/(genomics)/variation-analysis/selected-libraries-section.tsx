"use client";

import { HelpCircle } from "lucide-react";
import { Card, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SelectedItemsTable from "@/components/services/selected-items-table";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import type { VariationAnalysisController } from "./use-variation-analysis-form";

export function SelectedLibrariesSection({
  controller,
  className,
}: {
  controller: VariationAnalysisController;
  className: string;
}) {
  const { selectedLibraries, removeLibrary } = controller;
  return (
    <div className={className}>
      <Card className="h-full">
        <ServiceCardHeader>
          <ServiceCardTitle>
            Selected Libraries
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger aria-label="Help: Files selected for analysis">
                  <HelpCircle className="service-card-tooltip-icon" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Files selected for analysis</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ServiceCardTitle>
          <CardDescription>
            Place read files here using the arrow buttons.
          </CardDescription>
        </ServiceCardHeader>
        <ServiceCardContent>
          <SelectedItemsTable
            items={selectedLibraries.map((library) => ({
              id: library.id,
              name: library.name,
              type: library.type,
            }))}
            onRemove={removeLibrary}
            className="max-h-84 overflow-y-auto"
          />
        </ServiceCardContent>
      </Card>
    </div>
  );
}
