import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DomainsAndMotifsError from "../domains-and-motifs/error";
import EpitopeError from "../epitope/error";
import ExperimentError from "../experiment/error";
import FeatureError from "../feature/error";
import GenomeError from "../genome/error";
import ProteinStructureError from "../protein-structure/error";
import SerologyError from "../serology/error";
import StrainError from "../strain/error";
import SurveillanceError from "../surveillance/error";

interface ViewErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
}

const boundaries: [string, ComponentType<ViewErrorProps>][] = [
  ["domains-and-motifs", DomainsAndMotifsError],
  ["epitope", EpitopeError],
  ["experiment", ExperimentError],
  ["feature", FeatureError],
  ["genome", GenomeError],
  ["protein-structure", ProteinStructureError],
  ["serology", SerologyError],
  ["strain", StrainError],
  ["surveillance", SurveillanceError],
];

describe("(views) error boundaries", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  afterAll(() => {
    consoleError.mockRestore();
  });

  it.each(boundaries)("%s: Try again refetches the route instead of only resetting", async (_name, Boundary) => {
    const reset = vi.fn();
    const retry = vi.fn();

    render(<Boundary error={new Error("upstream down")} reset={reset} retry={retry} />);

    // reset() alone re-renders the same failed server payload; retry() also
    // refreshes the route so the server data is fetched again.
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });
});
