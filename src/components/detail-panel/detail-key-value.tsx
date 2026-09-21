import type { ReactNode } from "react";
import { formatDate } from "@/lib/services/workspace/helpers";

export interface DetailField {
  label: string;
  value: unknown;
  /** Render "date" to auto-format ISO strings */
  format?: "date";
  /**
   * Custom renderer — overrides default text rendering. The sole mechanism for
   * link fields: the caller (`info-panel.tsx`) routes the destination through
   * the `./metadata-link` boundary, which classifies internal versus external
   * and returns the built `Link`/`<a>` element supplied here, so this component
   * stays free of routing and URL-classification concerns.
   */
  render?: () => ReactNode;
}


export function DetailKeyValueTable({ fields }: { fields: DetailField[] }) {
  const visibleFields = fields.filter(
    (f) => f.value !== undefined && f.value !== null && f.value !== "",
  );

  if (visibleFields.length === 0) {
    return (
      <p className="px-2 py-1 text-xs text-muted-foreground italic">
        None available
      </p>
    );
  }

  return (
    <table className="w-full">
      <tbody>
        {visibleFields.map(({ label, value, format, render }) => {
          let display: ReactNode;
          if (render) {
            display = render();
          } else if (format === "date" && typeof value === "string") {
            display = formatDate(value);
          } else if (
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}T/.test(value)
          ) {
            display = formatDate(value);
          } else {
            display = String(value);
          }

          return (
            <tr key={label} className="border-b last:border-b-0">
              <td className="w-2/5 px-3 py-1.5 align-top text-xs font-medium text-muted-foreground">
                {label}
              </td>
              <td className="px-3 py-1.5 align-top text-xs break-all">
                {display}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
