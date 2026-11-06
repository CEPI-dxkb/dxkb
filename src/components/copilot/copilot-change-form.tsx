import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChangeForm({
  label,
  placeholder,
  autoFocus = false,
  value,
  onChange,
  onSend,
}: {
  label: string;
  placeholder: string;
  autoFocus?: boolean;
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
}) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const change = value.trim();
        if (change) onSend(change);
      }}
    >
      <Input
        value={value}
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!value.trim()}>
        Send
      </Button>
    </form>
  );
}
