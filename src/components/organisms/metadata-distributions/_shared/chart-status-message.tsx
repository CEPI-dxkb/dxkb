interface ChartStatusMessageProps {
  errorMessage?: string;
}

export function ChartStatusMessage({ errorMessage }: ChartStatusMessageProps) {
  return (
    <p role="alert" className="text-sm text-destructive">
      Could not load: {errorMessage ?? "unknown error"}
    </p>
  );
}

export function EmptyChart({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center pt-2">
      <svg
        viewBox="0 0 400 180"
        role="img"
        aria-label={`${title} distribution`}
        className="w-full"
      >
        <rect
          x="36"
          y="8"
          width="356"
          height="148"
          rx="3"
          fill="var(--muted-foreground)"
        />
      </svg>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="inline-block size-2.5 rounded-full border border-foreground/70 bg-muted-foreground"
          aria-hidden="true"
        />
        No data available
      </div>
    </div>
  );
}
