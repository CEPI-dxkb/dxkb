export function KeywordSearch({ value, onChange }) {
  return (
    <input
      className="border px-2 py-1 w-80 border-primary text-primary-background"
      placeholder="Search keywords..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}