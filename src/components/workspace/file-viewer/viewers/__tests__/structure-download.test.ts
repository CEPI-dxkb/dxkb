import { http, HttpResponse } from "msw";
import { gzipSync } from "node:zlib";

import {
  buildWorkspaceStructureSource,
  resolveProteinStructureSources,
} from "@/lib/protein-structure-view/source";
import { server } from "@/test-helpers/msw-server";
import {
  maintenancePage,
  maintenanceSummary,
} from "@/test-helpers/upstream-failures";

import { downloadStructure } from "../structure-download";

const workspaceSource = buildWorkspaceStructureSource(
  "crawler@patricbrc.org/home/test.pdb",
);
const [alphaFoldSource] = resolveProteinStructureSources({
  pdb_id: "AF-P0DTC2-F1",
});
const [rcsbSource] = resolveProteinStructureSources({ pdb_id: "6VXX" });

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe("downloadStructure", () => {
  it("returns a PDB or mmCIF file's text", async () => {
    server.use(
      http.get("*/api/workspace/view/*", () => new HttpResponse("ATOM 1")),
    );

    await expect(downloadStructure(workspaceSource, signal())).resolves.toBe(
      "ATOM 1",
    );
  });

  it("returns a BinaryCIF file's bytes", async () => {
    server.use(
      http.get(
        "https://structures.example/model.bcif",
        () => new HttpResponse(new Uint8Array([1, 2, 3])),
      ),
    );

    const contents = await downloadStructure(
      {
        url: "https://structures.example/model.bcif",
        format: "bcif",
        label: "model.bcif",
        kind: "url",
      },
      signal(),
    );

    expect(typeof contents).not.toBe("string");
    expect(Array.from(contents as Uint8Array)).toEqual([1, 2, 3]);
  });

  it("decompresses a gzipped workspace PDB or mmCIF file to its text", async () => {
    server.use(
      http.get(
        "*/api/workspace/view/*",
        () => new HttpResponse(gzipSync("ATOM 1\nEND\n")),
      ),
    );

    await expect(
      downloadStructure(
        buildWorkspaceStructureSource("u@bvbrc/home/model.cif.gz"),
        signal(),
      ),
    ).resolves.toBe("ATOM 1\nEND\n");
  });

  it("decompresses a gzipped BinaryCIF file to its bytes", async () => {
    server.use(
      http.get(
        "*/api/workspace/view/*",
        () => new HttpResponse(gzipSync(new Uint8Array([1, 2, 3]))),
      ),
    );

    const contents = await downloadStructure(
      buildWorkspaceStructureSource("u@bvbrc/home/model.bcif.gz"),
      signal(),
    );

    expect(Array.from(contents as Uint8Array)).toEqual([1, 2, 3]);
  });

  it("reads a .gz file that arrives already inflated as is", async () => {
    server.use(
      http.get("*/api/workspace/view/*", () => new HttpResponse("ATOM 1")),
    );

    await expect(
      downloadStructure(
        buildWorkspaceStructureSource("u@bvbrc/home/model.pdb.gz"),
        signal(),
      ),
    ).resolves.toBe("ATOM 1");
  });

  it("names the file when its gzip data is corrupt", async () => {
    server.use(
      http.get(
        "*/api/workspace/view/*",
        () => new HttpResponse(new Uint8Array([0x1f, 0x8b, 0, 0, 0])),
      ),
    );

    await expect(
      downloadStructure(
        buildWorkspaceStructureSource("u@bvbrc/home/model.pdb.gz"),
        signal(),
      ),
    ).rejects.toThrow(/^Could not decompress model\.pdb\.gz: /);
  });

  it("names the file, the server's reason and the status when the workspace route fails", async () => {
    server.use(
      http.get("*/api/workspace/view/*", () =>
        HttpResponse.json(
          {
            error:
              "The BV-BRC workspace service did not respond (timed out after 30 s).",
            code: "upstream",
          },
          { status: 504 },
        ),
      ),
    );

    await expect(
      downloadStructure(workspaceSource, signal()),
    ).rejects.toThrow(
      "Could not download test.pdb from your workspace: The BV-BRC workspace service did not respond (timed out after 30 s) (HTTP 504).",
    );
  });

  it("reduces an upstream maintenance page to its title", async () => {
    server.use(http.get(rcsbSource.url, () => maintenancePage()));

    await expect(downloadStructure(rcsbSource, signal())).rejects.toThrow(
      `Could not download 6VXX from the RCSB PDB: ${maintenanceSummary} (HTTP 503).`,
    );
  });

  it("reads a missing AlphaFold model as not found, not as a failure", async () => {
    server.use(
      http.get(
        alphaFoldSource.url,
        () =>
          new HttpResponse("<?xml version='1.0'?><Error><Code>NoSuchKey</Code></Error>", {
            status: 404,
            headers: { "Content-Type": "application/xml" },
          }),
      ),
    );

    await expect(downloadStructure(alphaFoldSource, signal())).rejects.toThrow(
      "AF-P0DTC2-F1 was not found in the AlphaFold database (HTTP 404).",
    );
  });

  it("names the file when the request never reaches a server", async () => {
    server.use(http.get(rcsbSource.url, () => HttpResponse.error()));

    await expect(downloadStructure(rcsbSource, signal())).rejects.toThrow(
      /^Could not download 6VXX from the RCSB PDB: \S/,
    );
  });

  it("passes the caller's abort through untouched", async () => {
    server.use(
      http.get(rcsbSource.url, async () => {
        await new Promise(() => undefined);
        return new HttpResponse("never");
      }),
    );
    const controller = new AbortController();

    const pending = downloadStructure(rcsbSource, controller.signal);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
