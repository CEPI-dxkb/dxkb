export function CardFrame({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm">
      <h4 className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}
