import { readFile } from "node:fs/promises";
import type { Download } from "@playwright/test";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  downloadErrorOverride,
  downloadFeatureCollectionOverride,
  downloadFeatureRows,
  downloadGatewayOverrides,
  downloadGenomeRow,
  e2eProteinResidues,
  emptyBackendFallbackOverrides,
  genomeDownloadTotalOverride,
  genomeDownloadTsv,
  genomeFeatureScenarioOverrides,
  genomeScenarioOverrides,
} from "../fixtures/overrides";
import { ResourceCollectionPage } from "../pages";

/**
 * The action rail's shared Download tile, end to end: the browser POSTs to the
 * real gateway route (`downloadGatewayOverrides` lets it through), the route's
 * own upstream request reaches the loopback mock, and the file the browser
 * saves is what the loopback answered. Signed out, because the loopback is
 * plain HTTP and the repository sends a token over HTTPS only.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function savedText(download: Download): Promise<string> {
  return readFile(await download.path(), "utf8");
}

function genomeCollection(page: Parameters<typeof applyBackendMocks>[0]) {
  return new ResourceCollectionPage(
    page,
    "genome",
    "genome",
    downloadGenomeRow.genome_id,
    downloadGenomeRow.genome_name,
  );
}

test("downloads every matching Genome as Text with nothing selected", async ({
  page,
}) => {
  await applyBackendMocks(page, {
    overrides: [
      ...downloadGatewayOverrides,
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = genomeCollection(page);
  await collection.goto("influenza");

  await collection.openDownload();
  await expect(collection.downloadScope("All")).toBeChecked();
  await expect(collection.downloadScope("Selected")).toBeDisabled();
  const sent = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/data/genome/download",
  );
  const saved = page.waitForEvent("download");
  await collection.downloadFormat("Text").click();

  const body = (await sent).postDataJSON() as Record<string, unknown>;
  expect(body).toMatchObject({
    format: "tsv",
    scope: { kind: "query", keyword: "influenza" },
    fileNameBase: "genome",
    total: 1,
  });
  const download = await saved;
  expect(download.suggestedFilename()).toBe("genome.txt");
  expect(await savedText(download)).toBe(genomeDownloadTsv);
});

test("downloads the selected Features as Protein FASTA, in selection order", async ({
  page,
}) => {
  const [first, second] = downloadFeatureRows;
  await applyBackendMocks(page, {
    overrides: [
      ...downloadGatewayOverrides,
      downloadFeatureCollectionOverride,
      ...genomeFeatureScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = new ResourceCollectionPage(
    page,
    "feature",
    "genome_feature",
    first.feature_id,
    first.product,
  );
  await collection.goto("replicase");

  // The second row first: the file follows the selection's order.
  await collection.rowCheckbox(second.feature_id).check();
  await collection.rowCheckbox(first.feature_id).check();
  await expect(collection.downloadTile()).toHaveText(/^DOWNLOAD\s*2$/);
  await collection.openDownload();
  await expect(collection.downloadScope("Selected")).toBeChecked();
  const sent = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/data/genome_feature/download",
  );
  const saved = page.waitForEvent("download");
  await collection.downloadFormat("Protein FASTA").click();

  expect((await sent).postDataJSON()).toMatchObject({
    format: "protein-fasta",
    scope: {
      kind: "selected",
      ids: [second.feature_id, first.feature_id],
    },
    fileNameBase: "genome_feature-selected",
  });
  const download = await saved;
  expect(download.suggestedFilename()).toBe(
    "genome_feature-selected.protein.fasta",
  );
  // One record per id, in the in() the gateway sent upstream.
  expect(await savedText(download)).toBe(
    `>${second.feature_id}\n${e2eProteinResidues}\n>${first.feature_id}\n${e2eProteinResidues}\n`,
  );
});

test("keeps an over-limit format listed, disabled, with its reason", async ({
  page,
}) => {
  await applyBackendMocks(page, {
    overrides: [
      ...downloadGatewayOverrides,
      genomeDownloadTotalOverride(2_000_000),
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = genomeCollection(page);
  await collection.goto("influenza");

  await collection.openDownload();
  await expect(collection.downloadScope("All")).toHaveAccessibleName(/2M/);
  const excel = collection.downloadFormat("Excel");
  await expect(excel).toBeDisabled();
  await expect(excel).toContainText("Over Excel's 1,048,576-row limit");
  await expect(collection.downloadFormat("DNA FASTA")).toContainText(
    "Sequences: 10,000 rows at most",
  );
  await expect(collection.downloadFormat("Text")).toBeEnabled();
});

test("streams an all-results download above 10,000 rows straight to disk", async ({
  page,
}) => {
  await applyBackendMocks(page, {
    overrides: [
      ...downloadGatewayOverrides,
      genomeDownloadTotalOverride(20_000),
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = genomeCollection(page);
  await collection.goto("influenza");

  await collection.openDownload();
  const sent = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/data/genome/download",
  );
  const saved = page.waitForEvent("download");
  await collection.downloadFormat("Text").click();

  // A native form POST, not a fetch: one `request` field holding the JSON.
  const request = await sent;
  expect(request.headers()["content-type"]).toContain(
    "application/x-www-form-urlencoded",
  );
  const field = new URLSearchParams(request.postData() ?? "").get("request");
  expect(JSON.parse(field ?? "null")).toMatchObject({
    format: "tsv",
    scope: { kind: "query", keyword: "influenza" },
    total: 20_000,
    nonce: expect.stringMatching(/^[0-9a-f]{32}$/),
  });
  const download = await saved;
  // Named by the gateway's Content-Disposition this time.
  expect(download.suggestedFilename()).toBe("genome.txt");
  expect(await savedText(download)).toBe(genomeDownloadTsv);
  // The nonce cookie ends the wait, so the rows are usable again.
  await expect(collection.downloadFormat("Text")).toBeEnabled();
});

test("streams a selected Genome's contigs straight to disk, however few rows", async ({
  page,
}) => {
  await applyBackendMocks(page, {
    overrides: [
      ...downloadGatewayOverrides,
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = genomeCollection(page);
  await collection.goto("influenza");

  await collection.selectRow();
  await collection.openDownload();
  await expect(collection.downloadScope("Selected")).toBeChecked();
  const sent = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/data/genome/download",
  );
  const saved = page.waitForEvent("download");
  await collection.downloadFormat("DNA FASTA").click();

  // One genome, yet a native form POST: its contigs have no size bound.
  const request = await sent;
  expect(request.headers()["content-type"]).toContain(
    "application/x-www-form-urlencoded",
  );
  const field = new URLSearchParams(request.postData() ?? "").get("request");
  expect(JSON.parse(field ?? "null")).toMatchObject({
    format: "dna-fasta",
    scope: { kind: "selected", ids: [downloadGenomeRow.genome_id] },
    nonce: expect.stringMatching(/^[0-9a-f]{32}$/),
  });
  const download = await saved;
  expect(download.suggestedFilename()).toBe("genome-selected.dna.fasta");
  expect(await savedText(download)).toBe(
    `>${downloadGenomeRow.genome_id}\nACGTACGTACGT\n`,
  );
  await expect(collection.downloadFormat("DNA FASTA")).toBeEnabled();
});

test("shows the gateway's own message when a download is refused", async ({
  page,
}) => {
  await applyBackendMocks(page, {
    overrides: [
      downloadErrorOverride("Selections: 10,000 rows at most."),
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = genomeCollection(page);
  await collection.goto("influenza");

  await collection.selectRow();
  await collection.openDownload();
  await collection.downloadFormat("CSV").click();

  await expect(page.getByText("Selections: 10,000 rows at most.")).toBeVisible();
  await expect(collection.downloadFormat("CSV")).toBeEnabled();
});
