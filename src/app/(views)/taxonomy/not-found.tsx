import Link from "next/link";

export default function TaxonomyNotFound() {
  return (
    <div className="m-4 rounded-lg border border-dashed p-8 text-center">
      <h1 className="text-xl font-semibold">Taxon not found</h1>
      <p className="my-2 text-sm text-muted-foreground">
        The taxon identifier is invalid, missing, or inaccessible.
      </p>
      <Link className="text-link underline underline-offset-2" href="/taxonomy">
        Browse taxa
      </Link>
    </div>
  );
}
