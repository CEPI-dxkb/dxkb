import { itemFields } from "@/lib/circular-viewer/item-fields";
import type { HoverItem } from "@/lib/circular-viewer/drawing";

export function ItemFieldList({ item, full }: { item: HoverItem; full: boolean }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {itemFields(item, full).map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
