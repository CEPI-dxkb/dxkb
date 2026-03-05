export function DetailHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="shrink-0 border-b px-3 py-2">
      <h3 className="truncate text-sm font-semibold">{title}</h3>
      {subtitle && (
        <p className="text-muted-foreground font-mono text-[11px]">
          {subtitle}
        </p>
      )}
    </div>
  );
}
