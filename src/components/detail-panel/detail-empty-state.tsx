export function DetailEmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
      {message}
    </div>
  );
}
