import { Input } from "../ui/input";

/**
 * How long a keyword box holds a draft before committing. Consumers where the
 * keyword is a request predicate must debounce, and share this interval so the
 * Interactions subview's two boxes settle in step.
 */
export const keywordDebounceMs = 300;

interface KeywordSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function KeywordSearch({ value, onChange, placeholder = "Search keywords..." }: KeywordSearchProps) {
  return (
            <Input
              type="search"
              variant="emphasis"
              className="w-80"
              placeholder={placeholder}
              value={value}
              onChange={(e) => { onChange(e.target.value); }}
            />

            
  );
}