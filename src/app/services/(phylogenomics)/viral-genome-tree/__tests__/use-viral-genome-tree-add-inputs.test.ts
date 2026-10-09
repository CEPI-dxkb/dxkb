import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";

import { useViralGenomeTree } from "../use-viral-genome-tree";
import {
  maxSequences,
  type ViralGenomeSequenceItem,
} from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-schema";
import type { ViralGenomeValidationResult } from "@/lib/services/genome";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import { server } from "@/test-helpers/msw-server";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: () => ({ isSubmitting: false, jobParamsDialogProps: {} }),
}));

const groupPath = "/testuser@bvbrc/home/Genome Groups/Influenza";
const otherGroupPath = "/testuser@bvbrc/home/Genome Groups/Dengue";
const invalidGroupHeading =
  "This looks like an invalid genome group. The following errors were found:";
const invalidGroupMessage = (...errors: string[]) =>
  [invalidGroupHeading, ...errors.map((error) => `- ${error}`)].join("\n");

function workspaceObject(path: string, type = "genome_group"): WorkspaceObject {
  return {
    id: path,
    name: path.split("/").pop() ?? path,
    type,
    path,
    isDirectory: false,
  };
}

/** A `Workspace.get` metadata tuple, as the workspace service returns it. */
function metadataTuple(path: string) {
  const name = path.split("/").pop() ?? path;
  return [
    name,
    "genome_group",
    path.slice(0, path.length - name.length),
    "2026-01-01T00:00:00Z",
    "object-id",
    "testuser@bvbrc",
    120,
    {},
    {},
    "o",
    "n",
    "",
  ];
}

function groupContent(genomeId: unknown) {
  return JSON.stringify({ name: "Influenza", id_list: { genome_id: genomeId } });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

/** Answers `Workspace.get` for any group with `content` as its data. */
function serveWorkspaceGet(content: unknown, gate?: Promise<void>) {
  server.use(
    http.post("*/api/services/workspace", async ({ request }) => {
      const body = (await request.json()) as {
        params: [{ objects: string[] }];
      };
      await gate;
      return HttpResponse.json({
        result: [[[metadataTuple(body.params[0].objects[0]), content]]],
      });
    }),
  );
}

function viralGenome(genomeId: string): ViralGenomeValidationResult {
  return {
    genome_id: genomeId,
    superkingdom: "Viruses",
    contigs: 1,
    genome_length: 13588,
  };
}

/** Answers validate-viral with valid viral metadata for every requested id. */
function serveViralValidation(gate?: Promise<void>) {
  const requestedIds: string[][] = [];
  server.use(
    http.post("*/api/services/genome/validate-viral", async ({ request }) => {
      const body = (await request.json()) as { genome_ids: string[] };
      requestedIds.push(body.genome_ids);
      await gate;
      return HttpResponse.json({ results: body.genome_ids.map(viralGenome) });
    }),
  );
  return requestedIds;
}

function serveValidationResults(results: ViralGenomeValidationResult[]) {
  server.use(
    http.post("*/api/services/genome/validate-viral", () =>
      HttpResponse.json({ results }),
    ),
  );
}

/** Records whether validate-viral was called; it must not be for an empty group. */
function watchValidation() {
  const calls = { count: 0 };
  server.use(
    http.post("*/api/services/genome/validate-viral", () => {
      calls.count += 1;
      return HttpResponse.json({ results: [] });
    }),
  );
  return calls;
}

function renderController() {
  return renderHook(() => useViralGenomeTree()).result;
}

type ControllerResult = ReturnType<typeof renderController>;

function selectGenomeGroup(result: ControllerResult, path = groupPath) {
  act(() => {
    result.current.setSelectedGenomeGroupObject(workspaceObject(path));
  });
}

function setSequences(
  result: ControllerResult,
  sequences: ViralGenomeSequenceItem[],
) {
  act(() => {
    result.current.form.setFieldValue("sequences", sequences);
  });
}

function fillToLimit(result: ControllerResult) {
  setSequences(
    result,
    Array.from({ length: maxSequences }, (_, index) => ({
      filename: `/testuser@bvbrc/home/fasta/${String(index)}.fasta`,
      type: "aligned_dna_fasta" as const,
    })),
  );
}

/**
 * Runs the add to completion. The handler is called as `void handleAddGenomeGroup()`,
 * so a rejection would be unhandled: every path must resolve.
 */
async function addGenomeGroup(result: ControllerResult) {
  await act(async () => {
    await expect(result.current.handleAddGenomeGroup()).resolves.toBeUndefined();
  });
}

/** Starts an add without awaiting it, for tests that act while it is in flight. */
function startAddGenomeGroup(result: ControllerResult) {
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = result.current.handleAddGenomeGroup();
  });
  return pending;
}

async function finish(pending: Promise<void>, release: () => void) {
  await act(async () => {
    release();
    await expect(pending).resolves.toBeUndefined();
  });
}

function expectSingleErrorToast(title: string, description: string) {
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(toast.error).toHaveBeenCalledWith(
    title,
    expect.objectContaining({ description }),
  );
  expect(toast.success).not.toHaveBeenCalled();
}

function errorToastDescription(): unknown {
  expect(toast.error).toHaveBeenCalledTimes(1);
  const [, options] = vi.mocked(toast.error).mock.calls[0];
  return options?.description;
}

function expectNotAdded(result: ControllerResult) {
  expect(result.current.form.state.values.sequences).toEqual([]);
  expect(result.current.isValidatingGenomeGroup).toBe(false);
}

describe("useViralGenomeTree genome group add", () => {
  describe("checks before any request", () => {
    it("asks for a selection when no group is selected", async () => {
      const result = renderController();

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "No object selected",
        "Please select a workspace object before adding.",
      );
      expectNotAdded(result);
    });

    it("rejects a group that is already in the list", async () => {
      const result = renderController();
      setSequences(result, [{ filename: groupPath, type: "genome_group" }]);
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "Duplicate selection detected",
        "This genome group is already selected.",
      );
      expect(result.current.form.state.values.sequences).toHaveLength(1);
      expect(result.current.isValidatingGenomeGroup).toBe(false);
    });

    it("rejects a group once the sequence limit is reached", async () => {
      const result = renderController();
      fillToLimit(result);
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "Selection limit reached",
        "A maximum of 5000 sequences can be added.",
      );
      expect(result.current.form.state.values.sequences).toHaveLength(
        maxSequences,
      );
      expect(result.current.isValidatingGenomeGroup).toBe(false);
    });
  });

  describe("a valid viral group", () => {
    it("is appended, clears the selection and reports its size", async () => {
      serveWorkspaceGet(groupContent(["11320.1", "11320.2", "11320.3"]));
      const requestedIds = serveViralValidation();
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(
        "Genome group added",
        expect.objectContaining({
          description: "Added genome group with 3 genomes.",
        }),
      );
      expect(toast.error).not.toHaveBeenCalled();
      expect(requestedIds).toEqual([["11320.1", "11320.2", "11320.3"]]);
      expect(result.current.form.state.values.sequences).toEqual([
        { filename: groupPath, type: "genome_group" },
      ]);
      expect(result.current.selectedGenomeGroupObject).toBeNull();
      expect(result.current.isValidatingGenomeGroup).toBe(false);
    });

    it("says genome, not genomes, for a group of one", async () => {
      serveWorkspaceGet(groupContent(["11320.1"]));
      serveViralValidation();
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expect(toast.success).toHaveBeenCalledWith(
        "Genome group added",
        expect.objectContaining({
          description: "Added genome group with 1 genome.",
        }),
      );
    });

    it("is read when its ids are stored as one comma-separated string", async () => {
      serveWorkspaceGet(groupContent("11320.1, 11320.2"));
      const requestedIds = serveViralValidation();
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expect(requestedIds).toEqual([["11320.1", "11320.2"]]);
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "Genome group added",
        expect.objectContaining({
          description: "Added genome group with 2 genomes.",
        }),
      );
      expect(result.current.form.state.values.sequences).toEqual([
        { filename: groupPath, type: "genome_group" },
      ]);
    });
  });

  describe("an invalid group", () => {
    it("lists alpha's errors for a comma-separated group of bacterial genomes", async () => {
      serveWorkspaceGet(groupContent("83332.12,511145.12"));
      serveValidationResults([
        {
          genome_id: "83332.12",
          superkingdom: "Bacteria",
          contigs: 1,
          genome_length: 4411532,
        },
        {
          genome_id: "511145.12",
          superkingdom: "Bacteria",
          contigs: 120,
          genome_length: 4641652,
        },
      ]);
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "Genome group validation failed",
        "This looks like an invalid genome group. The following errors were found:\n" +
          "- Invalid Superkingdom: only virus genomes are permitted\n" +
          "First occurrence for genome_id: 83332.12\n" +
          "- Error: genome exceeds maximum length 250000\n" +
          "First occurrence for genome_id: 83332.12\n" +
          "- Error: only 1 contig is permitted\n" +
          "First occurrence for genome_id: 511145.12",
      );
      expectNotAdded(result);
      expect(result.current.selectedGenomeGroupObject?.path).toBe(groupPath);
    });

    it("names the genomes the validation response left out", async () => {
      serveWorkspaceGet(groupContent(["11320.1", "11320.2", "11320.3"]));
      serveValidationResults([viralGenome("11320.1")]);
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "Genome group validation failed",
        invalidGroupMessage(
          "Missing validation metadata for 2 genomes. First occurrence: 11320.2",
        ),
      );
      expectNotAdded(result);
    });
  });

  describe("a group with no readable genome ids", () => {
    it.each([
      ["an empty genome_id array", groupContent([])],
      ["a genome_id array with no strings", groupContent([11320, null])],
      ["a genome_id string of only commas", groupContent(" , ,")],
      ["a numeric genome_id", groupContent(11320)],
      ["an object genome_id", groupContent({ first: "11320.1" })],
      ["a null genome_id", groupContent(null)],
      ["no id_list", JSON.stringify({ name: "Influenza" })],
      ["a null id_list", JSON.stringify({ id_list: null })],
      ["JSON that is not an object", JSON.stringify(["11320.1"])],
      ["JSON null", "null"],
      ["content that is neither JSON nor base64", "not json at all %%%"],
      ["base64 of something that is not JSON", btoa("hello world")],
      ["no content at all", null],
    ])("is reported as empty for %s", async (_label, content) => {
      serveWorkspaceGet(content);
      const validation = watchValidation();
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "Empty genome group",
        "The selected genome group is empty.",
      );
      expect(validation.count).toBe(0);
      expect(console.error).not.toHaveBeenCalledWith(
        "Failed to validate genome group:",
        expect.anything(),
      );
      expectNotAdded(result);
    });
  });

  describe("request failures", () => {
    it("shows the workspace's own message when Workspace.get fails", async () => {
      server.use(
        http.post("*/api/services/workspace", () =>
          HttpResponse.json({ error: "Object not found" }, { status: 500 }),
        ),
      );
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast("Validation error", "Object not found");
      expectNotAdded(result);
    });

    it("shows the upstream workspace message from the proxy's error shape", async () => {
      // What src/app/api/services/workspace/route.ts returns when BV-BRC fails.
      server.use(
        http.post("*/api/services/workspace", () =>
          HttpResponse.json(
            {
              error: "BV-BRC API error: 500 Internal Server Error",
              apiResponse: {
                code: -32603,
                message: `_ERROR_User lacks permission to ${groupPath}_ERROR_`,
              },
            },
            { status: 500 },
          ),
        ),
      );
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "Validation error",
        `User lacks permission to ${groupPath}`,
      );
      expectNotAdded(result);
    });

    it("shows the message of a JSON-RPC error answered with HTTP 200", async () => {
      server.use(
        http.post("*/api/services/workspace", () =>
          HttpResponse.json({
            error: { code: -32603, message: "_ERROR_Object not found_ERROR_" },
          }),
        ),
      );
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast("Validation error", "Object not found");
      expectNotAdded(result);
    });

    it.each([
      ["a null body", () => HttpResponse.json(null)],
      ["an empty body", () => new HttpResponse(null, { status: 200 })],
      ["an HTML body", () => HttpResponse.html("<html>proxy error</html>")],
      ["a string result", () => HttpResponse.json({ result: "unexpected" })],
    ])(
      "reports %s from Workspace.get as an invalid response, not a parse or type error",
      async (_label, respond) => {
        server.use(http.post("*/api/services/workspace", respond));
        const result = renderController();
        selectGenomeGroup(result);

        await addGenomeGroup(result);

        expectSingleErrorToast(
          "Validation error",
          "Invalid workspace response for genome group",
        );
        expectNotAdded(result);
      },
    );

    it.each([
      ["an empty body", () => new HttpResponse(null, { status: 200 })],
      ["a null body", () => HttpResponse.json(null)],
      ["no results list", () => HttpResponse.json({ results: "none" })],
      ["a null result entry", () => HttpResponse.json({ results: [null] })],
      ["an entry with no genome_id", () => HttpResponse.json({ results: [{}] })],
    ])(
      "treats a validate-viral response with %s as missing metadata",
      async (_label, respond) => {
        serveWorkspaceGet(groupContent(["11320.1"]));
        server.use(http.post("*/api/services/genome/validate-viral", respond));
        const result = renderController();
        selectGenomeGroup(result);

        await addGenomeGroup(result);

        expectSingleErrorToast(
          "Genome group validation failed",
          invalidGroupMessage(
            "Missing validation metadata for 1 genome. First occurrence: 11320.1",
          ),
        );
        expectNotAdded(result);
      },
    );

    it("falls back to a load failure when the error response has no body", async () => {
      server.use(
        http.post(
          "*/api/services/workspace",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast("Validation error", "Failed to load genome group");
      expectNotAdded(result);
    });

    it.each([
      ["an empty result", { result: [] }],
      ["no result", {}],
      ["an empty result container", { result: [[]] }],
      ["a null entry", { result: [[null]] }],
      ["an empty keyed container", { result: [{}] }],
      ["a keyed container with no entry", { result: [{ [groupPath]: [] }] }],
    ])(
      "reports an unusable Workspace.get envelope (%s)",
      async (_label, envelope) => {
        server.use(
          http.post("*/api/services/workspace", () =>
            HttpResponse.json(envelope),
          ),
        );
        const result = renderController();
        selectGenomeGroup(result);

        await addGenomeGroup(result);

        expectSingleErrorToast(
          "Validation error",
          "Invalid workspace response for genome group",
        );
        expectNotAdded(result);
      },
    );

    it("reports a network failure on Workspace.get", async () => {
      server.use(
        http.post("*/api/services/workspace", () => HttpResponse.error()),
      );
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expect(toast.error).toHaveBeenCalledWith(
        "Validation error",
        expect.anything(),
      );
      const description = errorToastDescription();
      expect(typeof description).toBe("string");
      expect(String(description).trim()).not.toBe("");
      expect(String(description)).not.toMatch(
        /filter|undefined|is not a function/,
      );
      expect(toast.success).not.toHaveBeenCalled();
      expectNotAdded(result);
    });

    it("shows the validation route's message when validate-viral fails", async () => {
      serveWorkspaceGet(groupContent(["11320.1"]));
      server.use(
        http.post("*/api/services/genome/validate-viral", () =>
          HttpResponse.json(
            { error: "BV-BRC genome validation failed: 502 Bad Gateway" },
            { status: 502 },
          ),
        ),
      );
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expectSingleErrorToast(
        "Validation error",
        "BV-BRC genome validation failed: 502 Bad Gateway",
      );
      expectNotAdded(result);
    });

    it("reports a network failure on validate-viral", async () => {
      serveWorkspaceGet(groupContent(["11320.1"]));
      server.use(
        http.post("*/api/services/genome/validate-viral", () =>
          HttpResponse.error(),
        ),
      );
      const result = renderController();
      selectGenomeGroup(result);

      await addGenomeGroup(result);

      expect(toast.error).toHaveBeenCalledWith(
        "Validation error",
        expect.anything(),
      );
      const description = errorToastDescription();
      expect(String(description).trim()).not.toBe("");
      expect(String(description)).not.toMatch(
        /filter|undefined|is not a function/,
      );
      expectNotAdded(result);
    });
  });

  describe("checks repeated after validation", () => {
    it("rejects the group if it was added while it was being validated", async () => {
      const gate = deferred();
      serveWorkspaceGet(groupContent(["11320.1"]), gate.promise);
      serveViralValidation();
      const result = renderController();
      selectGenomeGroup(result);

      const pending = startAddGenomeGroup(result);
      expect(result.current.isValidatingGenomeGroup).toBe(true);
      setSequences(result, [{ filename: groupPath, type: "genome_group" }]);
      await finish(pending, gate.resolve);

      expectSingleErrorToast(
        "Duplicate selection detected",
        "This genome group is already selected.",
      );
      expect(result.current.form.state.values.sequences).toHaveLength(1);
      expect(result.current.isValidatingGenomeGroup).toBe(false);
    });

    it("rejects the group if the limit was reached while it was being validated", async () => {
      const gate = deferred();
      serveWorkspaceGet(groupContent(["11320.1"]), gate.promise);
      serveViralValidation();
      const result = renderController();
      selectGenomeGroup(result);

      const pending = startAddGenomeGroup(result);
      fillToLimit(result);
      await finish(pending, gate.resolve);

      expectSingleErrorToast(
        "Selection limit reached",
        "A maximum of 5000 sequences can be added.",
      );
      expect(result.current.form.state.values.sequences).toHaveLength(
        maxSequences,
      );
      expect(result.current.isValidatingGenomeGroup).toBe(false);
    });
  });

  describe("stale requests", () => {
    it("drops a group whose Workspace.get resolves after Reset", async () => {
      const gate = deferred();
      serveWorkspaceGet(groupContent(["11320.1"]), gate.promise);
      serveViralValidation();
      const result = renderController();
      selectGenomeGroup(result);

      const pending = startAddGenomeGroup(result);
      expect(result.current.isValidatingGenomeGroup).toBe(true);
      act(() => {
        result.current.handleReset();
      });
      expect(result.current.isValidatingGenomeGroup).toBe(false);
      await finish(pending, gate.resolve);

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expectNotAdded(result);
    });

    it("drops a group whose validation resolves after Reset", async () => {
      const gate = deferred();
      serveWorkspaceGet(groupContent(["11320.1"]));
      const requestedIds = serveViralValidation(gate.promise);
      const result = renderController();
      selectGenomeGroup(result);

      const pending = startAddGenomeGroup(result);
      await vi.waitFor(() => {
        expect(requestedIds).toHaveLength(1);
      });
      act(() => {
        result.current.handleReset();
      });
      await finish(pending, gate.resolve);

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expectNotAdded(result);
    });

    it("shows no error for a request that fails after Reset", async () => {
      const gate = deferred();
      server.use(
        http.post("*/api/services/workspace", async () => {
          await gate.promise;
          return HttpResponse.json(
            { error: "Object not found" },
            { status: 500 },
          );
        }),
      );
      const result = renderController();
      selectGenomeGroup(result);

      const pending = startAddGenomeGroup(result);
      act(() => {
        result.current.handleReset();
      });
      await finish(pending, gate.resolve);

      expect(toast.error).not.toHaveBeenCalled();
      expectNotAdded(result);
    });

    it("keeps only the later group when a second add starts first", async () => {
      const gate = deferred();
      const ids: Record<string, string[]> = {
        [groupPath]: ["11320.1", "11320.2"],
        [otherGroupPath]: ["12637.1", "12637.2", "12637.3"],
      };
      server.use(
        http.post("*/api/services/workspace", async ({ request }) => {
          const body = (await request.json()) as {
            params: [{ objects: string[] }];
          };
          const path = body.params[0].objects[0];
          if (path === groupPath) await gate.promise;
          return HttpResponse.json({
            result: [[[metadataTuple(path), groupContent(ids[path])]]],
          });
        }),
      );
      serveViralValidation();
      const result = renderController();
      selectGenomeGroup(result, groupPath);

      const first = startAddGenomeGroup(result);
      selectGenomeGroup(result, otherGroupPath);
      await addGenomeGroup(result);
      await finish(first, gate.resolve);

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(
        "Genome group added",
        expect.objectContaining({
          description: "Added genome group with 3 genomes.",
        }),
      );
      expect(result.current.form.state.values.sequences).toEqual([
        { filename: otherGroupPath, type: "genome_group" },
      ]);
      expect(result.current.isValidatingGenomeGroup).toBe(false);
    });
  });
});

describe.each([
  {
    source: "aligned" as const,
    type: "aligned_dna_fasta" as const,
    label: "Aligned DNA FASTA",
    path: "/testuser@bvbrc/home/fasta/aligned.fasta",
  },
  {
    source: "unaligned" as const,
    type: "feature_dna_fasta" as const,
    label: "Unaligned DNA FASTA",
    path: "/testuser@bvbrc/home/fasta/unaligned.fasta",
  },
])("useViralGenomeTree $source FASTA add", ({ source, type, label, path }) => {
  function selectFasta(result: ControllerResult) {
    act(() => {
      const object = workspaceObject(path, type);
      if (source === "aligned") {
        result.current.setSelectedAlignedFastaObject(object);
      } else {
        result.current.setSelectedUnalignedFastaObject(object);
      }
    });
  }

  function selectedFasta(result: ControllerResult) {
    return source === "aligned"
      ? result.current.selectedAlignedFastaObject
      : result.current.selectedUnalignedFastaObject;
  }

  function addFasta(result: ControllerResult) {
    act(() => {
      result.current.handleAddSequence(source);
    });
  }

  it("asks for a selection when no file is selected", () => {
    const result = renderController();

    addFasta(result);

    expectSingleErrorToast(
      "No object selected",
      "Please select a workspace object before adding.",
    );
    expect(result.current.form.state.values.sequences).toEqual([]);
  });

  it("rejects a file that is already in the list", () => {
    const result = renderController();
    setSequences(result, [{ filename: path, type }]);
    selectFasta(result);

    addFasta(result);

    expectSingleErrorToast(
      "Duplicate selection detected",
      `${label} is already selected.`,
    );
    expect(result.current.form.state.values.sequences).toHaveLength(1);
    expect(selectedFasta(result)?.path).toBe(path);
  });

  it("rejects a file once the sequence limit is reached", () => {
    const result = renderController();
    fillToLimit(result);
    selectFasta(result);

    addFasta(result);

    expectSingleErrorToast(
      "Selection limit reached",
      "A maximum of 5000 sequences can be added.",
    );
    expect(result.current.form.state.values.sequences).toHaveLength(
      maxSequences,
    );
  });

  it("appends the file and clears the selection without a toast", () => {
    const result = renderController();
    selectFasta(result);

    addFasta(result);

    expect(result.current.form.state.values.sequences).toEqual([
      { filename: path, type },
    ]);
    expect(selectedFasta(result)).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
