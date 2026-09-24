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
          key={`${f.field}:${String(f.value)}`}
          className="flex items-center gap-2 rounded border-2 border-primary px-2 py-1"
        >
          <span>{f.field}: {String(f.value)}</span>
          <button type="button" aria-label={`Remove ${f.field}: ${String(f.value)} filter`} onClick={() => { onRemove(idx); }}>
            <span aria-hidden="true">x</span>
          </button>
        </div>
      ))}
    </div>
  );
}