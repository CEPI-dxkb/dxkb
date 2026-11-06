import { CircleCheck, CircleX } from "lucide-react";
import type { CopilotExecutionCard } from "@/lib/copilot/cards";

export function ExecutionAnswered({ card }: { card: CopilotExecutionCard }) {
  if (!card.answered) return null;
  if (card.answered.answer === "yes") {
    return (
      <p className="flex items-center gap-1.5 text-success">
        <CircleCheck className="size-4" aria-hidden />
        Sent. See the reply below and your Jobs list.
      </p>
    );
  }
  if (card.answered.answer === "no") {
    return (
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <CircleX className="size-4" aria-hidden />
        Not submitted.
      </p>
    );
  }
  return (
    <p className="text-muted-foreground">
      Changed: &ldquo;{card.answered.text ?? ""}&rdquo;. See the new set below.
    </p>
  );
}
