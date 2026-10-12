import type { Page } from "@playwright/test";
import {
  test,
  expect,
  applyBackendMocks,
  type JsonOverride,
} from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  e2eHomePath as home,
  journeyOverrides,
  workspaceObjectContentOverride,
  type TupleItem,
} from "../../fixtures/overrides";
import {
  browseButtonFor,
  FolderPickerDialog,
  selectorInputFor,
  ServiceFormPage,
} from "../../pages";

/**
 * Workspace file fields open the column picker from their Browse button.
 * Vitest covers the picker's file rules and both selector callback modes; this
 * spec covers each service's real form (portals, cards, hidden sections) and
 * the chosen file reaching the submitted job.
 */

const file = (
  parentPath: string,
  name: string,
  type: string,
  size = 1024,
): TupleItem => ({ name, type, parentPath, size });
const dir = (parentPath: string, name: string, type = "folder"): TupleItem => ({
  name,
  type,
  parentPath,
});

/** One file of every type the services ask for, plus a job result holding contigs. */
function fileTree(): Record<string, TupleItem[]> {
  return {
    [home]: [
      dir(home, "Assembly1", "job_result"),
      dir(home, "Inputs"),
      file(home, "sample_R1.fq", "reads"),
      file(home, "sample_R2.fq", "reads"),
    ],
    [`${home}/.Assembly1`]: [
      file(`${home}/.Assembly1`, "Assembly1_contigs.fasta", "contigs"),
    ],
    [`${home}/Inputs`]: [
      file(`${home}/Inputs`, "draft.contigs.fasta", "contigs"),
      file(`${home}/Inputs`, "genes.fna", "feature_dna_fasta"),
      file(`${home}/Inputs`, "proteins.faa", "feature_protein_fasta"),
      file(`${home}/Inputs`, "aligned.afa", "aligned_dna_fasta"),
      file(`${home}/Inputs`, "aligned-protein.afa", "aligned_protein_fasta"),
      file(`${home}/Inputs`, "groups.tsv", "tsv"),
      file(`${home}/Inputs`, "Flu genomes", "genome_group"),
      file(`${home}/Inputs`, "HA features", "feature_group"),
    ],
  };
}

/** Taxonomy lookups (the taxon name and ID fields) answered with `docs`. */
function taxonomyOverride(docs: object[]): JsonOverride {
  return { url: /\/api\/services\/taxonomy\?/, method: "GET", body: docs };
}

const fluGenomeIds = ["11320.1001", "11320.1002"];

/**
 * What MSA & SNP reads to check a pick before it enters the form: the genome
 * group's content and its genomes' viral metadata, and the start of the FASTA
 * file (at least two protein records, `minSequences`).
 */
const msaPickOverrides: JsonOverride[] = [
  workspaceObjectContentOverride(
    file(`${home}/Inputs`, "Flu genomes", "genome_group"),
    JSON.stringify({
      name: "Flu genomes",
      id_list: { genome_id: fluGenomeIds },
    }),
  ),
  {
    url: /\/api\/services\/genome\/validate-viral$/,
    method: "POST",
    matchBody: (parsed) =>
      JSON.stringify((parsed as { genome_ids?: unknown } | null)?.genome_ids) ===
      JSON.stringify(fluGenomeIds),
    body: {
      results: fluGenomeIds.map((genomeId) => ({
        genome_id: genomeId,
        superkingdom: "Viruses",
        contigs: 1,
        genome_length: 13500,
      })),
    },
  },
  {
    url: /\/api\/workspace\/preview\/.*\/Inputs\/proteins\.faa\?maxBytes=/,
    method: "GET",
    body: ">p1\nMKVLAAGIVGLLLAQ\n>p2\nMKTLLVAGAVALLAQ\n",
  },
];

/** Requests a service's form makes on load or on a pick, beyond the workspace. */
const serviceOverrides: Partial<Record<string, JsonOverride[]>> = {
  "msa-snp-analysis": msaPickOverrides,
  // The taxon fields look SARS-CoV-2 up on load.
  "sars-cov2-genome-analysis": [taxonomyOverride([])],
};

interface OpenServiceOptions {
  /** Overrides listed before the workspace's, so they win. */
  extra?: JsonOverride[];
  reflectUploads?: boolean;
  /** The app of a job the submission is answered with. */
  submits?: string;
}

/** Open `/services/<slug>`, or a full path, on `fileTree()`. */
async function openService(
  page: Page,
  path: string,
  options: OpenServiceOptions = {},
) {
  const job = options.submits
    ? {
        id: `job-${options.submits}`,
        app: options.submits,
        status: "queued" as const,
        submit_time: "2026-04-24T12:00:00Z",
        owner: "e2e-test-user",
        parameters: {},
      }
    : null;
  await applyBackendMocks(page, {
    overrides: [
      ...authSessionOverrides,
      ...(options.extra ?? []),
      ...buildWorkspaceOverrides({
        pathItems: fileTree(),
        reflectUploads: options.reflectUploads,
      }),
      ...buildJobsOverrides(
        job ? { jobs: [job], submitResponse: { job: [job] } } : {},
      ),
      ...journeyOverrides,
    ],
  });
  await page.goto(path.startsWith("/") ? path : `/services/${path}`);
}

type Reveal = { radio: string } | { select: string; option: string };

interface FileFieldCase {
  slug: string;
  placeholder: string;
  /** Which of the selectors with this placeholder, in page order (default 0). */
  index?: number;
  /** The controls that show the field, in order, when the default hides it. */
  reveal?: Reveal | Reveal[];
  folder: "Home" | "Inputs";
  file: string;
}

async function reveal(page: Page, how: Reveal | Reveal[]) {
  if (Array.isArray(how)) {
    for (const step of how) await reveal(page, step);
    return;
  }
  if ("radio" in how) {
    await page.getByRole("radio", { name: how.radio, exact: true }).check();
  } else {
    await page.getByRole("combobox", { name: how.select }).click();
    await page.getByRole("option", { name: how.option, exact: true }).click();
  }
}

const reads1 = "Select READ FILE 1...";
const reads2 = "Select READ FILE 2...";
const single = "Select READ FILE...";
const readTrio = (slug: string): FileFieldCase[] => [
  { slug, placeholder: reads1, folder: "Home", file: "sample_R1.fq" },
  { slug, placeholder: reads2, folder: "Home", file: "sample_R2.fq" },
  { slug, placeholder: single, folder: "Home", file: "sample_R1.fq" },
];

const fileFieldCases: FileFieldCase[] = [
  // blast: nothing on load (FASTA text, precomputed database).
  { slug: "blast", placeholder: "Select a FASTA file to search...", reveal: { radio: "Select FASTA file" }, folder: "Inputs", file: "genes.fna" },
  { slug: "blast", placeholder: "Select a feature group to search...", reveal: { radio: "Select feature group" }, folder: "Inputs", file: "HA features" },
  { slug: "blast", placeholder: "Select a genome group...", reveal: { select: "Database Source", option: "Search within selected genome group" }, folder: "Inputs", file: "Flu genomes" },
  { slug: "blast", placeholder: "Select a feature group...", reveal: { select: "Database Source", option: "Search within selected feature group" }, folder: "Inputs", file: "HA features" },
  { slug: "blast", placeholder: "Select a FASTA file...", reveal: { select: "Database Source", option: "Search within selected FASTA file" }, folder: "Inputs", file: "genes.fna" },

  ...readTrio("fastq-utilities"),

  { slug: "gene-protein-tree", placeholder: "Optional", index: 0, folder: "Inputs", file: "HA features" },
  { slug: "gene-protein-tree", placeholder: "Optional", index: 1, folder: "Inputs", file: "aligned.afa" },
  { slug: "gene-protein-tree", placeholder: "Optional", index: 2, folder: "Inputs", file: "genes.fna" },

  { slug: "genome-alignment", placeholder: "Select a genome group from your workspace", folder: "Inputs", file: "Flu genomes" },

  { slug: "genome-annotation", placeholder: "Select or Upload Contigs to your workspace for Annotation", folder: "Inputs", file: "draft.contigs.fasta" },

  ...readTrio("genome-assembly"),

  { slug: "influenza-ha-subtype", placeholder: "Select or upload FASTA file...", reveal: { radio: "Select FASTA file" }, folder: "Inputs", file: "proteins.faa" },
  { slug: "influenza-ha-subtype", placeholder: "Select a feature group...", reveal: { radio: "Feature group" }, folder: "Inputs", file: "HA features" },

  { slug: "meta-cats", placeholder: "Select feature group", folder: "Inputs", file: "HA features" },
  { slug: "meta-cats", placeholder: "Select feature group", reveal: { radio: "Feature Groups" }, folder: "Inputs", file: "HA features" },
  { slug: "meta-cats", placeholder: "Select alignment file", reveal: { radio: "Alignment File" }, folder: "Inputs", file: "aligned-protein.afa" },
  { slug: "meta-cats", placeholder: "Select group file (TSV)", reveal: { radio: "Alignment File" }, folder: "Inputs", file: "groups.tsv" },

  ...readTrio("metagenomic-binning"),
  { slug: "metagenomic-binning", placeholder: "Select or Upload Contigs...", reveal: { radio: "Assembled Contigs" }, folder: "Inputs", file: "draft.contigs.fasta" },

  ...readTrio("metagenomic-read-mapping"),
  { slug: "metagenomic-read-mapping", placeholder: "Select Gene Set FASTA File...", reveal: { radio: "FASTA File" }, folder: "Inputs", file: "genes.fna" },
  { slug: "metagenomic-read-mapping", placeholder: "Select Gene Set Feature Group...", reveal: { radio: "Feature Group" }, folder: "Inputs", file: "HA features" },

  { slug: "msa-snp-analysis", placeholder: "Select feature group", folder: "Inputs", file: "HA features" },
  { slug: "msa-snp-analysis", placeholder: "Select viral genome group", reveal: { radio: "Viral Genome Group" }, folder: "Inputs", file: "Flu genomes" },
  { slug: "msa-snp-analysis", placeholder: "Select FASTA file", reveal: { radio: "DNA or Protein FASTA File" }, folder: "Inputs", file: "proteins.faa" },
  { slug: "msa-snp-analysis", placeholder: "Select aligned FASTA file", reveal: { radio: "Aligned Sequences" }, folder: "Inputs", file: "aligned-protein.afa" },

  { slug: "primer-design", placeholder: "Select FASTA file from workspace", reveal: { radio: "Workspace FASTA" }, folder: "Inputs", file: "genes.fna" },

  { slug: "proteome-comparison", placeholder: "Select protein FASTA file (Optional)", index: 0, folder: "Inputs", file: "proteins.faa" },
  { slug: "proteome-comparison", placeholder: "Select protein FASTA file (Optional)", index: 1, folder: "Inputs", file: "proteins.faa" },
  { slug: "proteome-comparison", placeholder: "Select feature group (Optional)", index: 0, folder: "Inputs", file: "HA features" },
  { slug: "proteome-comparison", placeholder: "Select feature group (Optional)", index: 1, folder: "Inputs", file: "HA features" },
  { slug: "proteome-comparison", placeholder: "Select genome group (Optional)", folder: "Inputs", file: "Flu genomes" },

  ...readTrio("sars-cov2-genome-analysis"),
  { slug: "sars-cov2-genome-analysis", placeholder: "Select or Upload Contigs to your workspace for Annotation", reveal: { radio: "Assembled Contigs" }, folder: "Inputs", file: "draft.contigs.fasta" },

  ...readTrio("sars-cov2-wastewater-analysis"),

  { slug: "similar-genome-finder", placeholder: "Select a FASTA/FASTQ file...", folder: "Home", file: "sample_R1.fq" },

  { slug: "subspecies-classification", placeholder: "Select or upload FASTA file to your workspace.", reveal: { radio: "Select FASTA file" }, folder: "Inputs", file: "draft.contigs.fasta" },

  ...readTrio("taxonomic-classification"),

  ...readTrio("variation-analysis"),

  { slug: "viral-assembly", placeholder: reads1, folder: "Home", file: "sample_R1.fq" },
  { slug: "viral-assembly", placeholder: reads2, folder: "Home", file: "sample_R2.fq" },
  { slug: "viral-assembly", placeholder: single, reveal: { radio: "Single Read Library" }, folder: "Home", file: "sample_R1.fq" },
  { slug: "viral-assembly", placeholder: "Select a FASTA file...", reveal: [{ select: "Assembly Strategy", option: "Reference Guided Assembly" }, { radio: "Upload FASTA" }], folder: "Inputs", file: "genes.fna" },

  { slug: "viral-genome-tree", placeholder: "Optional", index: 0, folder: "Inputs", file: "Flu genomes" },
  { slug: "viral-genome-tree", placeholder: "Optional", index: 1, folder: "Inputs", file: "aligned.afa" },
  { slug: "viral-genome-tree", placeholder: "Optional", index: 2, folder: "Inputs", file: "genes.fna" },
];

/** The group files the fields pick: a group's picker is titled by the group, not "File". */
const groupPickers: Record<
  string,
  { title: string; accepts: string } | undefined
> = {
  "Flu genomes": {
    title: "Select a Genome Group",
    accepts: "Accepts genome groups.",
  },
  "HA features": {
    title: "Select a Feature Group",
    accepts: "Accepts feature groups.",
  },
};

/** " (after “…”)", naming the reveal, so meta-cats' two feature group fields differ. */
function revealSuffix(how: Reveal | Reveal[] | undefined): string {
  if (!how) return "";
  const last = Array.isArray(how) ? how.at(-1) : how;
  if (!last) return "";
  return ` (after “${"radio" in last ? last.radio : last.option}”)`;
}

test.describe("file picker: every service field", () => {
  for (const field of fileFieldCases) {
    const which = field.index ? ` #${String(field.index + 1)}` : "";
    test(`${field.slug}: “${field.placeholder}”${which}${revealSuffix(field.reveal)} browses for a file`, async ({
      page,
    }) => {
      await openService(page, field.slug, {
        extra: serviceOverrides[field.slug],
      });
      if (field.reveal) await reveal(page, field.reveal);
      const browse = browseButtonFor(page, field.placeholder).nth(
        field.index ?? 0,
      );
      const group = groupPickers[field.file];
      const picker = new FolderPickerDialog(
        page,
        group?.title ?? "Select a File",
        { browseButton: browse },
      );
      await picker.open();
      await expect(
        picker.dialog.getByText(group?.accepts ?? /Accepts .+ files\./),
      ).toBeVisible();
      if (field.folder === "Inputs") {
        await picker.option("Home", "Inputs").click();
      }
      await picker.fileOption(field.folder, field.file).dblclick();
      await expect(picker.dialog).toBeHidden();
      // Immediate and staged fields both show the chosen name.
      const input = selectorInputFor(page, field.placeholder).nth(
        field.index ?? 0,
      );
      await expect(input).toHaveValue(field.file);
      await expect(browse).toBeFocused();
      // The pick is accepted. MSA & SNP checks its group and FASTA picks
      // first, and a rejected pick stays on screen in the error state.
      await expect(
        page.getByText(/^(Validating genome group|Checking FASTA file)\.\.\.$/),
      ).toHaveCount(0);
      await expect(input).not.toHaveAttribute("aria-invalid", "true");
    });
  }
});

/** The next job submission's request. */
function nextSubmission(page: Page) {
  return page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/services/app-service/submit") &&
      request.method() === "POST",
  );
}

/** Store a rerun blob that `?rerun_key=<key>` copies onto the form on load. */
async function prefillRerun(page: Page, key: string, data: object) {
  await page.addInitScript(
    ({ key, data }) => {
      sessionStorage.setItem(key, JSON.stringify(data));
    },
    { key, data },
  );
}

test.describe("file picker: the chosen file reaches the job", () => {
  test("Genome Assembly: paired reads picked with Browse are submitted", async ({
    page,
  }) => {
    await prefillRerun(page, "e2e-assembly-rerun", {
      output_path: home,
      output_file: "assembly-e2e",
      recipe: "unicycler",
    });
    await openService(
      page,
      "/services/genome-assembly?rerun_key=e2e-assembly-rerun",
      { submits: "GenomeAssembly2" },
    );
    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue(
      "assembly-e2e",
    );

    for (const [placeholder, name] of [
      [reads1, "sample_R1.fq"],
      [reads2, "sample_R2.fq"],
    ] as const) {
      const picker = new FolderPickerDialog(page, "Select a File", {
        browseButton: browseButtonFor(page, placeholder),
      });
      await picker.open();
      await picker.fileOption("Home", name).dblclick();
      await expect(picker.dialog).toBeHidden();
      await expect(selectorInputFor(page, placeholder)).toHaveValue(name);
    }

    await page
      .getByRole("button", {
        name: "Add paired read library to selected libraries",
      })
      .click();
    // Both fields are controlled by the form's state, which Add clears.
    await expect(selectorInputFor(page, reads1)).toHaveValue("");
    await expect(selectorInputFor(page, reads2)).toHaveValue("");

    const submission = nextSubmission(page);
    await expect(page.getByRole("button", { name: /assemble/i })).toBeEnabled();
    await new ServiceFormPage(page, /genome assembly/i).submit(/assemble/i);
    const payload = (await submission).postDataJSON() as {
      app_params?: { paired_end_libs?: unknown[] };
    };
    expect(payload.app_params?.paired_end_libs?.[0]).toMatchObject({
      read1: `${home}/sample_R1.fq`,
      read2: `${home}/sample_R2.fq`,
    });
  });

  test("Genome Annotation: contigs picked from inside a job result are submitted", async ({
    page,
  }) => {
    await prefillRerun(page, "e2e-annotation-rerun", {
      output_path: home,
      output_file: "Escherichia coli e2e",
      recipe: "default",
      scientific_name: "Escherichia coli",
      taxonomy_id: "562",
      my_label: "e2e",
    });
    await openService(
      page,
      "/services/genome-annotation?rerun_key=e2e-annotation-rerun",
      {
        submits: "GenomeAnnotation",
        // Rerun looks the taxon's name up from its ID.
        extra: [
          taxonomyOverride([{ taxon_id: 562, taxon_name: "Escherichia coli" }]),
        ],
      },
    );
    const form = new ServiceFormPage(page, /genome annotation/i);
    await expect(form.heading).toBeVisible();

    const placeholder =
      "Select or Upload Contigs to your workspace for Annotation";
    const picker = new FolderPickerDialog(page, "Select a File", {
      browseButton: browseButtonFor(page, placeholder),
    });
    await picker.open();
    await picker.option("Home", "Assembly1").click();
    await expect(picker.column("Assembly1")).toBeVisible();
    await picker.fileOption("Assembly1", "Assembly1_contigs.fasta").dblclick();
    await expect(picker.dialog).toBeHidden();
    await expect(selectorInputFor(page, placeholder)).toHaveValue(
      "Assembly1_contigs.fasta",
    );

    const submission = nextSubmission(page);
    await expect(page.getByRole("button", { name: "Annotate" })).toBeEnabled();
    await form.submit("Annotate");
    const payload = (await submission).postDataJSON() as {
      app_params?: Record<string, unknown>;
    };
    expect(payload.app_params?.contigs).toBe(
      `${home}/.Assembly1/Assembly1_contigs.fasta`,
    );
  });

  test("Proteome Comparison: a protein FASTA picked with Browse is added to the list", async ({
    page,
  }) => {
    await openService(page, "proteome-comparison");
    const placeholder = "Select protein FASTA file (Optional)";
    // The second one is the comparison genomes' (the first is the reference).
    const picker = new FolderPickerDialog(page, "Select a File", {
      browseButton: browseButtonFor(page, placeholder).nth(1),
    });
    await picker.open();
    await picker.option("Home", "Inputs").click();
    await picker.fileOption("Inputs", "proteins.faa").dblclick();
    await expect(picker.dialog).toBeHidden();

    await page.getByRole("button", { name: "Add protein FASTA file" }).click();
    await expect(page.getByText("proteins.faa", { exact: true })).toBeVisible();
  });
});

test.describe("file picker: upload, then pick", () => {
  test("Genome Assembly: a read file uploaded in the picker is the one chosen", async ({
    page,
  }) => {
    await openService(page, "genome-assembly", { reflectUploads: true });
    const picker = new FolderPickerDialog(page, "Select a File", {
      browseButton: browseButtonFor(page, reads1),
    });
    await picker.open();
    await picker.option("Home", "Inputs").click();
    await picker.dialog.getByRole("button", { name: "Upload here" }).click();
    // The type the field asks for is chosen already. (The trigger's text also
    // holds its arrow, so read the value.)
    await expect(
      picker.dialog
        .getByRole("combobox", { name: "Upload type" })
        .locator('[data-slot="select-value"]'),
    ).toHaveText("Reads");

    // Hold the multipart POST until it has been sent. Routes registered later
    // run first, so this one wins over the default mock.
    const uploadHeld = Promise.withResolvers<undefined>();
    await page.route(/\/api\/services\/workspace\/upload/, async (route) => {
      await uploadHeld.promise;
      await route.fulfill({ json: { success: true, id: "upload-1" } });
    });
    await picker.dialog.locator('input[type="file"]').setInputFiles({
      name: "uploaded_R1.fq",
      mimeType: "text/plain",
      buffer: Buffer.from("@r1\nACGT\n+\nFFFF\n"),
    });
    const upload = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/services/workspace/upload") &&
        request.method() === "POST",
    );
    await picker.dialog.getByRole("button", { name: "Start Upload" }).click();
    await upload;

    uploadHeld.resolve(undefined);
    await expect(picker.selectButton).toHaveAccessibleName(
      "Select “uploaded_R1.fq”",
    );
    await picker.fileOption("Inputs", "uploaded_R1.fq").dblclick();
    await expect(picker.dialog).toBeHidden();
    await expect(selectorInputFor(page, reads1)).toHaveValue("uploaded_R1.fq");
  });
});
