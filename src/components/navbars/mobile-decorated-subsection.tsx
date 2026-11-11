import type { ReactNode } from "react";

interface MobileDecoratedSubSectionProps {
  children: ReactNode;
  alwaysShow?: boolean;
  dotColor?: string;
  lineColor?: string;
  curveColor?: string;
}

export function MobileDecoratedSubSection({
  children,
  alwaysShow = false,
  dotColor = alwaysShow
    ? "bg-secondary"
    : "bg-secondary/40 group-data-open/sub:bg-secondary",
  lineColor = "bg-secondary/25",
  curveColor = "border-secondary/25",
}: MobileDecoratedSubSectionProps) {
  const showClass = alwaysShow ? "" : "hidden group-data-open/sub:block";

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-4">
          <span className={`size-1.5 shrink-0 rounded-full ${dotColor}`} />
          <div className={`mt-0.5 w-0.5 flex-1 ${lineColor} ${showClass}`} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <div
        className={`ml-0.5 h-3 rounded-bl-xl border-b-2 border-l-2 ${curveColor} ${showClass}`}
      />
    </div>
  );
}
