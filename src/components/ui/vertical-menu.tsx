import { Button } from "@/components/buttons/button";
import { cn } from "@/lib/utils";

interface NavMenuItem {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

interface NavMenuProps {
  items: NavMenuItem[];
  isCollapsed: boolean;
}

export function VerticalMenu({ items, isCollapsed }: NavMenuProps) {
  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <Button
          key={index}
          onClick={item.onClick}
          variant="ghost"
          className={cn(
            "min-w-[2.5rem] justify-start h-10 p-2 transition-[width] duration-300 ease-in-out",
            item.isActive && "bg-gray-300 hover:bg-gray-300 text-secondary hover:text-secondary/50",
            !item.isActive && "text-gray-700 hover:text-primary hover:bg-gray-200",
            isCollapsed && "w-10",
            !isCollapsed && "w-full"

          )}
          title={isCollapsed ? item.label : undefined}
        >
          <div className="flex items-center gap-2 h-full">
            <span className="shrink-0 w-6 h-6 flex items-center justify-center">{item.icon}</span>
            <span className={`
              overflow-hidden whitespace-nowrap
              transition-[width,opacity] duration-300 ease-in-out
              ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
            `}>
              {item.label}
            </span>
          </div>
        </Button>
      ))}
    </div>
  );
}