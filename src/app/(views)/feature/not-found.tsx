import Link from "next/link";

export default function FeatureNotFound() {
  return (
    <div className="m-4 rounded-lg border border-dashed p-8 text-center">
      <h1 className="text-xl font-semibold">Feature not found</h1>
      <p className="my-2 text-sm text-muted-foreground">
        The feature identifier is invalid, missing, ambiguous, or inaccessible.
      </p>
      <Link className="text-primary underline underline-offset-2 dark:text-link" href="/feature">
        Browse features
      </Link>
    </div>
  );
}
