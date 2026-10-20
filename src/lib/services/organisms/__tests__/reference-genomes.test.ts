import { http, HttpResponse } from "msw";

import { fetchReferenceGenomes } from "@/lib/services/organisms/reference-genomes";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

describe("fetchReferenceGenomes", () => {
  it("reads the scope's reference genomes", async () => {
    let requestedUrl = "";
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([
          {
            reference_genome: "Reference",
            genome_name: "Escherichia coli K-12",
            genome_id: "511145.12",
          },
        ]);
      }),
    );

    await expect(fetchReferenceGenomes(562)).resolves.toEqual([
      {
        reference_genome: "Reference",
        genome_name: "Escherichia coli K-12",
        genome_id: "511145.12",
      },
    ]);
    expect(decodeURIComponent(requestedUrl)).toContain("eq(reference_genome,*)");
  });

  // The card names the section ("Reference genomes could not be loaded"), so
  // a message never repeats it, nor names the endpoint.
  it("says what is wrong with a payload that is not a list", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () => HttpResponse.json({ response: [] })),
    );

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(
      /^Unexpected BV-BRC response shape: expected an array of genomes$/,
    );
  });

  it("says which genome is not an object", async () => {
    server.use(http.get(`${baseUrl}/genome/`, () => HttpResponse.json([null])));

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(
      /^Unexpected BV-BRC response shape: genome 0 is not an object$/,
    );
  });
});
