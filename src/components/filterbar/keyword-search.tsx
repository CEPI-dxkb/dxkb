import { Input } from "../ui/input";

interface KeywordSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function KeywordSearch({ value, onChange }: KeywordSearchProps) {
  return (
            <Input
              type="search"
              className="border px-2 py-1 w-80 border-primary text-primary-background"
              placeholder="Search keywords..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />

            
  );
}