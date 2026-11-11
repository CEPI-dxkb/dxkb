vi.mock("server-only", () => ({}));

import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isWithinDirectory } from "../dataset-inventory";
import {
  availableDatasetIds,
  fetchRemoteDataset,
  readDataset,
  remoteDatasetExists,
  resetDatasetInventoryForTests,
} from "../dataset-store";

const validDataset = '{"version":"v2","meta":{},"tree":{}}';

let root: string;
let datasetDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "nextstrain-store-"));
  datasetDir = join(root, "datasets");
  await mkdir(datasetDir);
  process.env.NEXTSTRAIN_DATASET_DIR = datasetDir;
  resetDatasetInventoryForTests();
});

afterEach(async () => {
  delete process.env.NEXTSTRAIN_DATASET_DIR;
  resetDatasetInventoryForTests();
  await rm(root, { recursive: true, force: true });
});

describe("Nextstrain dataset store", () => {
  it("lists only valid main datasets and deduplicates identifiers", async () => {
    await Promise.all([
      writeFile(
        join(datasetDir, "Influenza-A-Virus_H3N2_HA.json"),
        validDataset,
      ),
      writeFile(
        join(datasetDir, "Influenza-A-Virus_H3N2_HA_root-sequence.json"),
        "{}",
      ),
      writeFile(join(datasetDir, "invalid__dataset.json"), "{}"),
      writeFile(join(datasetDir, "notes.txt"), "ignored"),
    ]);

    expect([...(await availableDatasetIds())]).toEqual([
      "Influenza-A-Virus/H3N2/HA",
    ]);
  });

  it("consistently rejects a dataset id whose final segment names a sidecar", async () => {
    // "Influenza-A-Virus_H3N2_measurements.json" is ambiguous between dataset "Influenza-A-Virus/H3N2" plus a measurements sidecar and a main dataset "…/measurements", so the id must be rejected everywhere.
    await writeFile(
      join(datasetDir, "Influenza-A-Virus_H3N2_measurements.json"),
      validDataset,
    );

    await expect(availableDatasetIds()).resolves.toEqual(new Set());
    await expect(
      readDataset("Influenza-A-Virus/H3N2/measurements"),
    ).resolves.toBeNull();
  });

  it("caches successful inventory reads", async () => {
    await writeFile(join(datasetDir, "Orthoebolavirus_100.json"), validDataset);
    expect(await availableDatasetIds()).toEqual(
      new Set(["Orthoebolavirus/100"]),
    );

    await writeFile(join(datasetDir, "Orthoebolavirus_500.json"), validDataset);
    expect(await availableDatasetIds()).toEqual(
      new Set(["Orthoebolavirus/100"]),
    );
  });

  it("clears a failed inventory so a later read can recover", async () => {
    process.env.NEXTSTRAIN_DATASET_DIR = join(root, "late-mount");
    await expect(availableDatasetIds()).rejects.toThrow();

    await mkdir(process.env.NEXTSTRAIN_DATASET_DIR);
    await writeFile(
      join(process.env.NEXTSTRAIN_DATASET_DIR, "Orthoebolavirus_500.json"),
      validDataset,
    );
    await expect(availableDatasetIds()).resolves.toEqual(
      new Set(["Orthoebolavirus/500"]),
    );
  });

  it("exposes only regular, in-store, parseable v2 datasets", async () => {
    const outside = join(root, "outside.json");
    await Promise.all([
      writeFile(
        join(datasetDir, "Valid_2.0.json"),
        '{"version":"2.0","meta":{},"tree":{}}',
      ),
      writeFile(join(datasetDir, "Malformed.json"), "{"),
      writeFile(
        join(datasetDir, "Wrong_Version.json"),
        '{"version":"v1","meta":{},"tree":{}}',
      ),
      writeFile(
        join(datasetDir, "Missing_Tree.json"),
        '{"version":"v2","meta":{}}',
      ),
      mkdir(join(datasetDir, "Directory.json")),
      writeFile(outside, validDataset),
    ]);
    await symlink(outside, join(datasetDir, "Escaping.json"));
    await symlink(
      join(root, "missing.json"),
      join(datasetDir, "Dangling.json"),
    );

    await expect(availableDatasetIds()).resolves.toEqual(
      new Set(["Valid/2.0"]),
    );
  });

  it("refreshes inventory after an explicit reset", async () => {
    await writeFile(join(datasetDir, "Orthoebolavirus_100.json"), validDataset);
    await expect(availableDatasetIds()).resolves.toEqual(
      new Set(["Orthoebolavirus/100"]),
    );

    await writeFile(join(datasetDir, "Orthoebolavirus_500.json"), validDataset);
    resetDatasetInventoryForTests();
    await expect(availableDatasetIds()).resolves.toEqual(
      new Set(["Orthoebolavirus/100", "Orthoebolavirus/500"]),
    );
  });

  it("reads exact main and every supported sidecar without mutating content", async () => {
    const main = validDataset;
    await Promise.all([
      writeFile(join(datasetDir, "Influenza-A-Virus_H3N2_HA.json"), main),
      ...(["tip-frequencies", "root-sequence", "measurements"] as const).map(
        (sidecar) =>
          writeFile(
            join(datasetDir, `Influenza-A-Virus_H3N2_HA_${sidecar}.json`),
            JSON.stringify({ sidecar }),
          ),
      ),
    ]);

    await expect(readDataset("Influenza-A-Virus/H3N2/HA")).resolves.toBe(main);
    for (const sidecar of [
      "tip-frequencies",
      "root-sequence",
      "measurements",
    ] as const) {
      await expect(
        readDataset("Influenza-A-Virus/H3N2/HA", sidecar),
      ).resolves.toBe(JSON.stringify({ sidecar }));
    }
    await expect(
      readDataset("Influenza-A-Virus/H3N2/NA", "measurements"),
    ).resolves.toBeNull();
  });

  it("returns null for absent or invalid exact identifiers", async () => {
    await writeFile(join(datasetDir, "Influenza-A-Virus_H3N2_HA.json"), "H3N2");

    await expect(readDataset("Influenza-A-Virus/H3N2/HA")).resolves.toBe(
      "H3N2",
    );
    await expect(readDataset("Influenza-A-Virus/H5N1/HA")).resolves.toBeNull();
    await expect(readDataset("../outside")).resolves.toBeNull();
  });

  it("returns null when the resolved target is a directory", async () => {
    await mkdir(join(datasetDir, "Orthoebolavirus_100.json"));

    await expect(readDataset("Orthoebolavirus/100")).resolves.toBeNull();
  });

  it("rejects a dataset symlink that escapes the store", async () => {
    const outside = join(root, "outside.json");
    await writeFile(outside, "secret");
    await symlink(outside, join(datasetDir, "Orthoebolavirus_100.json"));

    await expect(readDataset("Orthoebolavirus/100")).resolves.toBeNull();
  });

  it("treats a root store directory as containing its children", () => {
    // `startsWith(parent + sep)` fails at "/" because `${directory}${sep}` becomes "//".
    expect(isWithinDirectory("/", "/Orthoebolavirus_100.json")).toBe(true);
    expect(isWithinDirectory("/", "/")).toBe(true);
    expect(isWithinDirectory("/store", "/store/Orthoebolavirus_100.json")).toBe(
      true,
    );
    expect(isWithinDirectory("/store", "/store-evil/leak.json")).toBe(false);
    expect(isWithinDirectory("/store", "/outside/leak.json")).toBe(false);
  });

  it("treats an unconfigured local store as an empty optional fallback", async () => {
    delete process.env.NEXTSTRAIN_DATASET_DIR;

    await expect(availableDatasetIds()).resolves.toEqual(new Set());
    await expect(readDataset("Orthoebolavirus/100")).resolves.toBeNull();
  });

  it.each([
    ["a rejected probe", new Error("remote unavailable")],
    ["a 5xx probe", new Response(null, { status: 503 })],
  ])("preserves %s for remote dataset fetching", async (_state, result) => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
    );

    await expect(fetchRemoteDataset("Orthoebolavirus/100")).rejects.toThrow();
  });

  it("lets availability checks fail closed when a remote probe fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("remote unavailable"),
    );

    await expect(remoteDatasetExists("Orthoebolavirus/100")).resolves.toBe(false);
  });

  it("returns null when a remote probe confirms the dataset is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    );

    await expect(fetchRemoteDataset("Orthoebolavirus/100")).resolves.toBeNull();
  });
});
