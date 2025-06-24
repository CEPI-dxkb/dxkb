import React from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { HelpCircle } from "lucide-react";

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
  allowDuplicates = false,
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
          className="inline-block h-0 w-0 border-[5px] border-transparent"
          style={{
            borderBottomWidth: "8px",
            borderBottomColor: color.replace("bg-", ""),
          }}
        />
      );
    }

    return <div className={`h-2.5 w-2.5 ${color} ${getShapeClass(shape)}`} />;
  };

  return (
    <>
      {(title || description || tooltipContent) && (
        <div className="mb-0">
          <div className="flex flex-row items-center gap-2">
            {title && <Label className="service-card-label">{title}</Label>}
            {tooltipContent && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
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
        className={`bg-background/20 overflow-auto rounded-md border p-4 ${className}`}
      >
        <div className="h-full overflow-y-auto rounded-md border">
          {items.length === 0 ? (
            <div className="text-muted-foreground h-full bg-white p-4.5 text-center text-sm">
              {emptyMessage}
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id + item.type}
                  className="flex items-center justify-between bg-white px-4 py-2 hover:bg-gray-50"
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
                        <div className="text-muted-foreground text-xs">
                          {item.type}
                        </div>
                      )}
                      {item.description && (
                        <div className="text-muted-foreground text-xs">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemove(item.id)}
                  >
                    <span className="text-gray-400 hover:text-gray-600">×</span>
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
