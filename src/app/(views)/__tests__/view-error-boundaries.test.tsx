import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RouteErrorProps } from "@/components/errors/view-error-boundary";

import DomainsAndMotifsError from "../domains-and-motifs/error";
import EpitopeError from "../epitope/error";
import ExperimentError from "../experiment/error";
import FeatureError from "../feature/error";
import GenomeError from "../genome/error";
import ProteinStructureError from "../protein-structure/error";
import SerologyError from "../serology/error";
import StrainError from "../strain/error";
import SurveillanceError from "../surveillance/error";
import TaxonomyError from "../taxonomy/error";

const boundaries: [string, ComponentType<RouteErrorProps>, string][] = [
  ["domains-and-motifs", DomainsAndMotifsError, "/domains-and-motifs"],
  ["epitope", EpitopeError, "/epitope"],
  ["experiment", ExperimentError, "/experiment"],
  ["feature", FeatureError, "/feature"],
  ["genome", GenomeError, "/genome"],
  ["protein-structure", ProteinStructureError, "/protein-structure"],
  ["serology", SerologyError, "/serology"],
  ["strain", StrainError, "/strain"],
  ["surveillance", SurveillanceError, "/surveillance"],
  ["taxonomy", TaxonomyError, "/taxonomy"],
];

// What production hands a boundary for a thrown server-component error.
function redactedServerError(): Error & { digest: string } {
  return Object.assign(
    new Error(
      "Minified React error #441; visit https://react.dev/errors/441 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
    ),
    { digest: "3227098399" },
  );
}

describe("(views) error boundaries", () => {
  it.each(boundaries)(
    "%s: Retry refetches the route instead of only resetting",
    async (_name, Boundary) => {
      const reset = vi.fn();
      const retry = vi.fn();

      render(
        <Boundary error={new Error("upstream down")} reset={reset} retry={retry} />,
      );

      // reset() alone re-renders the same failed server payload; retry() also
      // refreshes the route so the server data is fetched again.
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(retry).toHaveBeenCalledOnce();
      expect(reset).not.toHaveBeenCalled();
    },
  );

  it.each(boundaries)(
    "%s: a redacted server error shows fixed copy and its digest, never React's text",
    (_name, Boundary) => {
      render(
        <Boundary error={redactedServerError()} reset={vi.fn()} retry={vi.fn()} />,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/could not be loaded/);
      expect(alert).not.toHaveTextContent(/Minified React error/);
      expect(alert).toHaveTextContent("Reference: 3227098399");
    },
  );

  it.each(boundaries)(
    "%s: links back to its collection",
    (_name, Boundary, href) => {
      render(
        <Boundary error={redactedServerError()} reset={vi.fn()} retry={vi.fn()} />,
      );

      expect(screen.getByRole("link", { name: /^Browse / })).toHaveAttribute(
        "href",
        href,
      );
    },
  );

  it.each(boundaries.filter(([name]) => name !== "domains-and-motifs"))(
    "%s: a client error without a digest keeps its own message",
    (_name, Boundary) => {
      render(
        <Boundary
          error={new Error("Feature table could not parse row 12")}
          reset={vi.fn()}
          retry={vi.fn()}
        />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Feature table could not parse row 12",
      );
      expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument();
    },
  );
});
