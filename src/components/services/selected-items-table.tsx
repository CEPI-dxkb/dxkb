import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ServiceLabel } from "@/components/services/form-ui/service-label";

import { HelpCircle, X } from "lucide-react";
import type { CSSProperties } from "react";

interface SelectedItem {
  id: string;
  name: string;
  type?: string;
  description?: string;
  color?: string;
  shape?: string;
}

interface SelectedItemsTableProps {
  title?: string;
  description?: string;
  tooltipContent?: string;
  items: SelectedItem[];
  onRemove: (id: string) => void;
  emptyMessage?: string;
  className?: string;
  allowDuplicates?: boolean;
}

const SelectedItemsTable = ({
  title,
  description,
  tooltipContent,
  items,
  onRemove,
  emptyMessage = "No items selected",
  className = "",
  allowDuplicates: _allowDuplicates = false,
}: SelectedItemsTableProps) => {
  const getShapeClass = (shape?: string) => {
    switch (shape) {
      case "circle":
        return "rounded-full";
      case "square":
        return "rounded-none";
      case "diamond":
        return "rotate-45";
      default:
        return "rounded-full";
    }
  };

  const renderShape = (color?: string, shape?: string) => {
    if (!color) return null;

    if (shape === "triangle") {
      return (
        <div
          className="inline-block size-0 border-5 border-b-8 border-transparent border-b-(--triangle-color)"
          style={
            {
              "--triangle-color": color.replace("bg-", ""),
            } as CSSProperties
          }
        />
      );
    }

    return <div className={`size-2.5 ${color} ${getShapeClass(shape)}`} />;
  };

  return (
    <>
      {(title || description || tooltipContent) && (
        <div className="mb-0">
          <div className="flex flex-row items-center gap-2">
            {title && <ServiceLabel>{title}</ServiceLabel>}
            {tooltipContent && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger aria-label={`${title ?? "Field"} help`}>
                    <HelpCircle className="service-card-tooltip-icon mb-2" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltipContent}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {description && (
            <p className="service-card-sublabel">{description}</p>
          )}
        </div>
      )}
      <div
        className={`overflow-auto rounded-md border bg-background/20 p-4 ${className}`}
      >
        <div className="h-full overflow-y-auto rounded-md border">
          {items.length === 0 ? (
            <div className="h-full bg-muted/50 p-4.5 text-center text-sm text-foreground">
              {emptyMessage}
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={`${item.id}${item.type ?? ""}`}
                  className="flex items-center justify-between bg-muted/50 px-4 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-sm">{item.name}</span>
                      {(item.color || item.shape) && (
                        <div className="ml-2 inline-flex items-center gap-2">
                          {renderShape(item.color, item.shape)}
                        </div>
                      )}
                      {item.type && (
                        <div className="text-xs text-muted-foreground">
                          {item.type}
                        </div>
                      )}
                      {item.description && (
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost-secondary"
                    size="icon"
                    className="size-6"
                    aria-label="Remove item"
                    onClick={() => { onRemove(item.id); }}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SelectedItemsTable;
