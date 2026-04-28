interface SelectedFilter {
  field: string;
  value: unknown; // or be stricter if you know the type (string | number | etc.)
}

interface SelectedFiltersProps {
  selected: SelectedFilter[];
  onRemove: (index: number) => void;
}

export function SelectedFilters({ selected, onRemove }: SelectedFiltersProps) {
  if (!selected.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {selected.map((f, idx) => (
        <div
          key={idx}
          className="border border-primary border-2 text-primary-background px-2 py-1 rounded flex items-center gap-2"
        >
          <span>{f.field}: {String(f.value)}</span>
          <button onClick={() => onRemove(idx)}>✕</button>
        </div>
      ))}
    </div>
  );
}