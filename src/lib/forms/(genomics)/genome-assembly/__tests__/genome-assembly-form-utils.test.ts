vi.mock("./genome-assembly-form-schema", () => ({}));

import {
  transformGenomeAssemblyParams,
  calculateGenomeSize,
  genomeSizeDisplay,
  rerunGenomeAssemblyAdvancedOptions,
} from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-form-utils";

describe("transformGenomeAssemblyParams", () => {
  const baseData = {
    recipe: "auto",
    output_path: "/workspace/output",
    output_file: "assembly_result",
    paired_end_libs: [],
    single_end_libs: [],
    srr_ids: [],
  };

  it("returns basic fields (recipe, output_path, output_file)", () => {
    const result = transformGenomeAssemblyParams(baseData);

    expect(result).toEqual(
      expect.objectContaining({
        recipe: "auto",
        output_path: "/workspace/output",
        output_file: "assembly_result",
      }),
    );
  });

  it("does not include empty arrays for libraries or srr_ids", () => {
    const result = transformGenomeAssemblyParams(baseData);

    expect(result).not.toHaveProperty("paired_end_libs");
    expect(result).not.toHaveProperty("single_end_libs");
    expect(result).not.toHaveProperty("srr_ids");
  });

  it("includes paired_end_libs and strips _ prefixed keys", () => {
    const data = {
      ...baseData,
      paired_end_libs: [
        {
          _id: "internal-id",
          _type: "paired",
          read1: "/reads/r1.fq",
          read2: "/reads/r2.fq",
          interleaved: false,
        },
      ],
    };

    const result = transformGenomeAssemblyParams(data as never);

    expect(result.paired_end_libs).toEqual([
      {
        read1: "/reads/r1.fq",
        read2: "/reads/r2.fq",
        interleaved: false,
      },
    ]);
  });

  it("includes single_end_libs and strips _ prefixed keys", () => {
    const data = {
      ...baseData,
      single_end_libs: [
        {
          _id: "single-id",
          _type: "single",
          read: "/reads/single.fq",
        },
      ],
    };

    const result = transformGenomeAssemblyParams(data as never);

    expect(result.single_end_libs).toEqual([
      {
        read: "/reads/single.fq",
      },
    ]);
  });

  it("includes srr_ids when provided", () => {
    const data = {
      ...baseData,
      srr_ids: ["SRR123456", "SRR789012"],
    };

    const result = transformGenomeAssemblyParams(data);

    expect(result.srr_ids).toEqual(["SRR123456", "SRR789012"]);
  });

  it("includes genome_size when greater than 0", () => {
    const data = {
      ...baseData,
      genome_size: 5000000,
    };

    const result = transformGenomeAssemblyParams(data);

    expect(result.genome_size).toBe(5000000);
  });

  it("does not include genome_size when it is 0", () => {
    const data = {
      ...baseData,
      genome_size: 0,
    };

    const result = transformGenomeAssemblyParams(data);

    expect(result).not.toHaveProperty("genome_size");
  });

  it("does not include genome_size when undefined", () => {
    const result = transformGenomeAssemblyParams(baseData);

    expect(result).not.toHaveProperty("genome_size");
  });

  it("includes advanced params when defined", () => {
    const data = {
      ...baseData,
      trim: true,
      normalize: false,
      filtlong: true,
      target_depth: 200,
      racon_iter: 2,
      pilon_iter: 3,
      min_contig_len: 300,
      min_contig_cov: 5,
    };

    const result = transformGenomeAssemblyParams(data);

    expect(result).toEqual(
      expect.objectContaining({
        trim: true,
        normalize: false,
        filtlong: true,
        target_depth: 200,
        racon_iter: 2,
        pilon_iter: 3,
        min_contig_len: 300,
        min_contig_cov: 5,
      }),
    );
  });

  it("does not include advanced params when undefined", () => {
    const result = transformGenomeAssemblyParams(baseData);

    expect(result).not.toHaveProperty("trim");
    expect(result).not.toHaveProperty("normalize");
    expect(result).not.toHaveProperty("filtlong");
    expect(result).not.toHaveProperty("target_depth");
    expect(result).not.toHaveProperty("racon_iter");
    expect(result).not.toHaveProperty("pilon_iter");
    expect(result).not.toHaveProperty("min_contig_len");
    expect(result).not.toHaveProperty("min_contig_cov");
  });
});

describe("calculateGenomeSize", () => {
  it("multiplies by 1000000 when unit is M", () => {
    expect(calculateGenomeSize(5, "M")).toBe(5000000);
  });

  it("multiplies by 1000 when unit is K", () => {
    expect(calculateGenomeSize(500, "K")).toBe(500000);
  });

  it("handles decimal values with M unit", () => {
    expect(calculateGenomeSize(1.5, "M")).toBe(1500000);
  });

  it("handles decimal values with K unit", () => {
    expect(calculateGenomeSize(2.5, "K")).toBe(2500);
  });

  it("returns 0 when expected genome size is 0", () => {
    expect(calculateGenomeSize(0, "M")).toBe(0);
    expect(calculateGenomeSize(0, "K")).toBe(0);
  });
});

describe("genomeSizeDisplay", () => {
  it("shows whole megabases in M", () => {
    expect(genomeSizeDisplay(5000000)).toEqual({ count: 5, unit: "M" });
  });

  it("shows anything else in K, rounded to the kilobase the field can hold", () => {
    expect(genomeSizeDisplay(500000)).toEqual({ count: 500, unit: "K" });
    expect(genomeSizeDisplay(4641652)).toEqual({ count: 4642, unit: "K" });
  });
});

describe("rerunGenomeAssemblyAdvancedOptions", () => {
  it("restores every advanced option the job ran with", () => {
    expect(
      rerunGenomeAssemblyAdvancedOptions({
        genome_size: 4600000,
        target_depth: 250,
        trim: false,
        normalize: true,
        filtlong: false,
        racon_iter: 3,
        pilon_iter: 1,
        min_contig_len: 500,
        min_contig_cov: 10,
      }),
    ).toEqual({
      values: {
        genome_size: 4600000,
        target_depth: 250,
        trim: false,
        normalize: true,
        filtlong: false,
        racon_iter: 3,
        pilon_iter: 1,
        min_contig_len: 500,
        min_contig_cov: 10,
      },
      genomeSize: { count: 4600, unit: "K" },
    });
  });

  it("reads the strings and flags job parameters can arrive as", () => {
    const { values } = rerunGenomeAssemblyAdvancedOptions({
      target_depth: "300",
      trim: "false",
      normalize: "true",
      filtlong: 1,
      racon_iter: "0",
    });
    expect(values).toEqual({
      target_depth: 300,
      trim: false,
      normalize: true,
      filtlong: true,
      racon_iter: 0,
    });
  });

  it("keeps the job's genome size and rounds only what the field shows", () => {
    expect(
      rerunGenomeAssemblyAdvancedOptions({ genome_size: "4641652" }),
    ).toEqual({
      values: { genome_size: 4641652 },
      genomeSize: { count: 4642, unit: "K" },
    });
  });

  it("leaves out options the job did not set or set to nonsense", () => {
    expect(
      rerunGenomeAssemblyAdvancedOptions({
        output_file: "x",
        genome_size: 0,
        target_depth: "lots",
        min_contig_len: null,
        racon_iter: "",
        pilon_iter: "  ",
      }),
    ).toEqual({ values: {} });
  });
});
