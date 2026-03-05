import type { ReactNode } from "react";

export function DetailPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
