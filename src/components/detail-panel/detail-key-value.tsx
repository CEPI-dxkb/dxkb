import type { ReactNode } from "react";
import { formatDate } from "@/lib/services/workspace/helpers";

export interface DetailField {
  label: string;
  value: unknown;
  /** Render "date" to auto-format ISO strings */
  format?: "date";
  /** Render value as a link */
  href?: string;
  /** Custom renderer — overrides default text rendering */
  render?: () => ReactNode;
}


export function DetailKeyValueTable({ fields }: { fields: DetailField[] }) {
  const visibleFields = fields.filter(
    (f) => f.value !== undefined && f.value !== null && f.value !== "",
  );

  if (visibleFields.length === 0) {
    return (
      <p className="text-muted-foreground px-2 py-1 text-xs italic">
        None available
      </p>
    );
  }

  return (
    <table className="w-full">
      <tbody>
        {visibleFields.map(({ label, value, format, href, render }) => {
          let display: ReactNode;
          if (render) {
            display = render();
          } else if (href) {
            display = (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {String(value)}
              </a>
            );
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
              <td className="text-muted-foreground w-[40%] px-3 py-1.5 text-xs font-medium align-top">
                {label}
              </td>
              <td className="break-all px-3 py-1.5 text-xs align-top">
                {display}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
