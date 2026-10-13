import Link from "next/link";

export default function StrainNotFound() {
  return (
    <div className="m-4 rounded-lg border border-dashed p-8 text-center">
      <h1 className="text-xl font-semibold">Strain not found</h1>
      <p className="my-2 text-sm text-muted-foreground">
        The strain identifier is invalid, missing, or inaccessible.
      </p>
      <Link
        className="text-primary underline underline-offset-2"
        href="/strain"
      >
        Browse strains
      </Link>
    </div>
  );
}
