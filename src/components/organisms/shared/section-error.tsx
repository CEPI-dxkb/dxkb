import { AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SectionErrorProps {
  title?: string;
  message: string;
}

export function SectionError({
  title = "Section unavailable",
  message,
}: SectionErrorProps) {
  return (
    <Card variant="panel-error">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <AlertTriangle />
            {title}
          </div>
        </CardTitle>
        <CardDescription>Upstream data could not be loaded.</CardDescription>
      </CardHeader>
      <CardContent>
        <pre
          data-testid="section-error-message"
          className="rounded-md bg-background p-3 text-xs wrap-break-word whitespace-pre-wrap text-foreground"
        >
          {message}
        </pre>
      </CardContent>
    </Card>
  );
}
