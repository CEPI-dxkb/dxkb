import Link from "next/link";

interface AmbiguityChoiceProps {
  sampleId: string;
  testTypes: readonly string[];
  title: string;
  titleId: string;
  recordType: string;
  browseHref: string;
  getChoiceHref: (sampleId: string, testType: string) => string;
}

export function AmbiguityChoice({
  sampleId,
  testTypes,
  title,
  titleId,
  recordType,
  browseHref,
  getChoiceHref,
}: AmbiguityChoiceProps) {
  return (
    <section
      className="m-4 max-w-3xl rounded-lg border bg-card p-6"
      aria-labelledby={titleId}
    >
      <h1 id={titleId} className="text-xl font-semibold">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sample <strong className="text-foreground">{sampleId}</strong> has
        multiple {recordType} records. Select a test type to open the intended
        record.
      </p>
      {testTypes.length > 0 ? (
        <ul className="mt-5 grid gap-2">
          {testTypes.map((testType) => (
            <li key={testType}>
              <Link
                className="block rounded-md border px-4 py-3 text-primary underline-offset-4 hover:bg-muted hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-link"
                href={getChoiceHref(sampleId, testType)}
              >
                {testType}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-md bg-muted p-4 text-sm">
          No test-type labels are available for these records.
        </p>
      )}
      <Link
        className="mt-6 inline-block text-sm text-primary underline underline-offset-2 dark:text-link"
        href={browseHref}
      >
        Browse {recordType} records
      </Link>
    </section>
  );
}
