import { Input } from "../ui/input";

/**
 * How long a keyword box holds a draft before committing it.
 *
 * `KeywordSearch` is uncontrolled-draft-free by design — it reports every input
 * event — so each consumer owns the draft and the timer. Where a keyword is a
 * *request* predicate, committing per keystroke amplifies one search into one
 * request per character, so those consumers must debounce. They share this
 * interval, because the Interactions subview has two keyword boxes writing the
 * same shared value and they have to settle in step.
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
              className="w-80 border border-primary bg-card px-2 py-1 text-card-foreground dark:bg-card"
              placeholder={placeholder}
              value={value}
              onChange={(e) => { onChange(e.target.value); }}
            />

            
  );
}