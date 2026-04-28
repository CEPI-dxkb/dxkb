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
    <div className="min-w-[200px] text-white text-[10px]">
      {/* Title */}
      <div className="font-semibold mb-2 border-b border-gray-500">
        {field.label}
      </div>

      {/* Values */}
      <div className="flex flex-col max-h-[70px] overflow-y-auto">
        {items.length === 0 && (
          <div className="text-gray-400">No values</div>
        )}

        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onSelect(field.id, item.value)}
            className="text-left hover:bg-gray-700 px-1 py-[2px] rounded"
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>
    </div>
  );
}