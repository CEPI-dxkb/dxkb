interface FacetItem{
  label: string;
  value: string;
  count: number;
};

interface FacetColumnProps {
  field: { id: string; label: string };
  items: FacetItem[];
  onSelect: (field: string, value: string) => void;
};

export function FacetColumn({ field, items, onSelect }: FacetColumnProps) {
  return (
    <div className="max-w-48 shrink-0 text-xs">
      {/* Title */}
      <div className="mb-2 border-b font-semibold">
        {field.label}
      </div>

      {/* Values */}
      <div className="flex max-h-17.5 flex-col overflow-y-auto">
        {items.length === 0 && (
          <div className="text-muted-foreground">No values</div>
        )}

        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => { onSelect(field.id, item.value); }}
            className="rounded px-1 py-0.5 text-left hover:bg-muted"
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>
    </div>
  );
}