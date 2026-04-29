vi.mock("./genome-annotation-form-schema", () => ({}));

import {
  transformGenomeAnnotationParams,
  createGenomeAnnotationFormValues,
  generateOutputFileName,
  validateMyLabel,
} from "../genome-annotation-form-utils";

describe("transformGenomeAnnotationParams", () => {
  it("includes all expected fields", () => {
    const data = {
      contigs: "/my/contigs.fa",
      recipe: "default",
      scientific_name: "Escherichia coli",
      taxonomy_id: "562",
      my_label: "test-run",
      output_file: "output.genome",
      output_path: "/workspace/output",
    };

    const result = transformGenomeAnnotationParams(data as never);

    expect(result).toEqual({
      contigs: "/my/contigs.fa",
      recipe: "default",
      scientific_name: "Escherichia coli",
      taxonomy_id: "562",
      my_label: "test-run",
      output_file: "output.genome",
      output_path: "/workspace/output",
    });
  });

  it("defaults scientific_name to empty string when falsy", () => {
    const data = {
      contigs: "/my/contigs.fa",
      recipe: "default",
      scientific_name: "",
      taxonomy_id: "",
      my_label: "label",
      output_file: "out.genome",
      output_path: "/workspace",
    };

    const result = transformGenomeAnnotationParams(data as never);

    expect(result).toEqual(
      expect.objectContaining({
        scientific_name: "",
        taxonomy_id: "",
      }),
    );
  });
});

describe("createGenomeAnnotationFormValues", () => {
  it("merges overrides into current values", () => {
    const current = {
      contigs: "/old/contigs.fa",
      recipe: "default",
      scientific_name: "Old name",
      taxonomy_id: "1",
      my_label: "old-label",
      output_file: "old.genome",
      output_path: "/old/path",
    };

    const overrides = {
      recipe: "viral" as const,
      my_label: "new-label",
    };

    const result = createGenomeAnnotationFormValues(
      current as never,
      overrides,
    );

    expect(result).toEqual({
      contigs: "/old/contigs.fa",
      recipe: "viral",
      scientific_name: "Old name",
      taxonomy_id: "1",
      my_label: "new-label",
      output_file: "old.genome",
      output_path: "/old/path",
    });
  });
});

describe("generateOutputFileName", () => {
  it("uses only the label when scientific name is null", () => {
    expect(generateOutputFileName(null, "my-run")).toBe("my-run");
  });

  it("extracts the last word of the scientific name", () => {
    expect(generateOutputFileName("Escherichia coli", "")).toBe("coli");
  });

  it("removes special characters from the extracted name part", () => {
    expect(generateOutputFileName("Genus species(strain)", "")).toBe(
      "speciesstrain",
    );
  });

  it("joins scientific name part and label with a space when both present", () => {
    expect(generateOutputFileName("Escherichia coli", "run1")).toBe(
      "coli run1",
    );
  });
});

describe("validateMyLabel", () => {
  it("returns valid for a normal string", () => {
    expect(validateMyLabel("my-label")).toEqual({
      isValid: true,
      message: "",
    });
  });

  it("returns invalid when label contains a forward slash", () => {
    const result = validateMyLabel("bad/label");
    expect(result.isValid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("returns invalid when label contains a backslash", () => {
    const result = validateMyLabel("bad\\label");
    expect(result.isValid).toBe(false);
    expect(result.message).toBeTruthy();
  });
});
