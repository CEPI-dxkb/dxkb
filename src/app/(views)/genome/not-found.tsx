import Link from "next/link";

export default function GenomeNotFound() {
  return (
    <div className="m-4 rounded-lg border border-dashed p-8 text-center">
      <h1 className="text-xl font-semibold">Genome not found</h1>
      <p className="my-2 text-sm text-muted-foreground">
        The genome identifier is invalid, missing, or inaccessible.
      </p>
      <Link
        className="text-primary underline underline-offset-2 dark:text-link"
        href="/genome"
      >
        Browse genomes
      </Link>
    </div>
  );
}
