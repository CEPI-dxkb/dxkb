import type { JobListItem } from "@/types/workspace";
import {
  formatElapsedSeconds,
  formatServiceName,
  formatUnixTimestamp,
  getOutputName,
} from "../formatting";

// ── formatServiceName ──────────────────────────────────────────────

describe("formatServiceName", () => {
  it("returns the display name for a known service", () => {
    expect(formatServiceName("Homology")).toBe("BLAST");
    expect(formatServiceName("MetaCATS")).toBe("Meta-CATS");
    expect(formatServiceName("GenomeAssembly2")).toBe("Genome Assembly");
  });

  it("applies regex formatting for an unknown service", () => {
    expect(formatServiceName("SomeNewService")).toBe("Some New Service");
  });

  it('returns "" for an empty string', () => {
    expect(formatServiceName("")).toBe("");
  });
});

// ── getOutputName ──────────────────────────────────────────────────

describe("getOutputName", () => {
  it("returns output_file when present on the job", () => {
    const job = {
      output_file: "my-results",
      parameters: {},
    } as unknown as JobListItem;

    expect(getOutputName(job)).toBe("my-results");
  });

  it("falls back to parameters.output_file when output_file is absent", () => {
    const job = {
      parameters: { output_file: "param-results" },
    } as unknown as JobListItem;

    expect(getOutputName(job)).toBe("param-results");
  });

  it('returns em-dash "\u2014" when both output_file and parameters.output_file are missing', () => {
    const job = { parameters: {} } as unknown as JobListItem;

    expect(getOutputName(job)).toBe("\u2014");
  });
});

// ── formatElapsedSeconds ───────────────────────────────────────────

describe("formatElapsedSeconds", () => {
  it('formats 0 seconds as "0s"', () => {
    expect(formatElapsedSeconds(0)).toBe("0s");
  });

  it('formats 65 seconds as "1m5s"', () => {
    expect(formatElapsedSeconds(65)).toBe("1m5s");
  });

  it('returns "\u2014" for a negative number', () => {
    expect(formatElapsedSeconds(-1)).toBe("\u2014");
  });

  it('returns "\u2014" for NaN', () => {
    expect(formatElapsedSeconds(NaN)).toBe("\u2014");
  });

  it('returns "\u2014" for Infinity', () => {
    expect(formatElapsedSeconds(Infinity)).toBe("\u2014");
  });

  it('returns "\u2014" for undefined', () => {
    expect(formatElapsedSeconds(undefined)).toBe("\u2014");
  });
});

// ── formatUnixTimestamp ────────────────────────────────────────────

describe("formatUnixTimestamp", () => {
  it("formats a valid timestamp as a non-empty, non-dash string", () => {
    const result = formatUnixTimestamp(1700000000);

    expect(result).not.toBe("");
    expect(result).not.toBe("\u2014");
  });

  it('returns "\u2014" for undefined', () => {
    expect(formatUnixTimestamp(undefined)).toBe("\u2014");
  });

  it('returns "\u2014" for NaN', () => {
    expect(formatUnixTimestamp(NaN)).toBe("\u2014");
  });
});
