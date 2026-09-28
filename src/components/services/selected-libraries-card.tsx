import { HelpCircle } from "lucide-react";
import SelectedItemsTable from "@/components/services/selected-items-table";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ServiceCardContent,
  ServiceCardDescription,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

interface SelectedLibrary {
  id: string;
  name: string;
  type: string;
}

interface SelectedLibrariesCardProps {
  items: SelectedLibrary[];
  onRemove: (id: string) => void;
  tableClassName?: string;
}

export function SelectedLibrariesCard({
  items,
  onRemove,
  tableClassName,
}: SelectedLibrariesCardProps) {
  return (
    <Card className="h-full">
      <ServiceCardHeader>
        <ServiceCardTitle>
          Selected Libraries
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger aria-label="Help: place read files using arrow buttons">
                <HelpCircle className="service-card-tooltip-icon" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Place read files here using the arrow buttons</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ServiceCardTitle>
        <ServiceCardDescription>
          Place read files here using the arrow buttons.
        </ServiceCardDescription>
      </ServiceCardHeader>
      <ServiceCardContent>
        <SelectedItemsTable
          items={items.map((library) => ({
            id: library.id,
            name: library.name,
            type: getLibraryTypeLabel(library.type),
          }))}
          onRemove={onRemove}
          className={tableClassName}
        />
      </ServiceCardContent>
    </Card>
  );
}
