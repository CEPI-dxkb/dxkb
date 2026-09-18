import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { DataRepository } from "../client";
import { dataQueryKeys, memberQueryOptions } from "../query-options";

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("memberQueryOptions", () => {
  it("keys the member query on the full request, including the requested fields", () => {
    const repository = new DataRepository();
    const request = {
      id: "100.1",
      idField: "genome_id",
      fields: ["genome_id", "genome_name"],
    };

    expect(memberQueryOptions(repository, "genome", request).queryKey).toEqual(
      dataQueryKeys.member("genome", request),
    );
    expect(
      memberQueryOptions(repository, "genome", {
        ...request,
        fields: [...request.fields, "host_name"],
      }).queryKey,
    ).not.toEqual(memberQueryOptions(repository, "genome", request).queryKey);
  });

  it("issues a fresh HTTP request and returns the newly requested fields when the projection changes for the same ID", async () => {
    let requestCount = 0;
    server.use(
      http.get("/api/data/genome", ({ request }) => {
        requestCount += 1;
        const url = new URL(request.url);
        const fields = url.searchParams.getAll("field");
        return HttpResponse.json({
          row: fields.includes("host_name")
            ? { genome_id: "100.1", genome_name: "Projected", host_name: "Human" }
            : { genome_id: "100.1", genome_name: "Projected" },
        });
      }),
    );

    const repository = new DataRepository();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result, rerender } = renderHook(
      ({ fields }: { fields: string[] }) =>
        useQuery(
          memberQueryOptions(repository, "genome", {
            id: "100.1",
            idField: "genome_id",
            fields,
          }),
        ),
      {
        wrapper: wrapper(client),
        initialProps: { fields: ["genome_id", "genome_name"] },
      },
    );

    await waitFor(() => {
      expect(result.current.data?.row).toMatchObject({
        genome_name: "Projected",
      });
    });
    expect(result.current.data?.row).not.toHaveProperty("host_name");
    expect(requestCount).toBe(1);

    rerender({ fields: ["genome_id", "genome_name", "host_name"] });

    await waitFor(() => {
      expect(result.current.data?.row).toMatchObject({ host_name: "Human" });
    });
    expect(requestCount).toBe(2);
  });
});
