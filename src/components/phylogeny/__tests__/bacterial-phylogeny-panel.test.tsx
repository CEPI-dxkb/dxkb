import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import { BacterialPhylogenyPanel } from "../bacterial-phylogeny-panel";

const treePath = "/api/phylogeny/bacterial-trees/562";
const outageMessage =
  "The BV-BRC phylogeny tree dictionary is unavailable (HTTP 503 Service Unavailable).";

describe("BacterialPhylogenyPanel", () => {
  it("shows the route's real cause in an alert and refetches on Retry", async () => {
    let calls = 0;
    server.use(
      http.get(treePath, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: outageMessage, code: "service_unavailable" },
            { status: 503 },
          );
        }
        return HttpResponse.json({ filename: null });
      }),
    );

    render(<BacterialPhylogenyPanel taxonId={562} taxonName="Escherichia coli" />, {
      wrapper: createQueryClientWrapper(),
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Phylogeny could not be loaded");
    expect(alert).toHaveTextContent(outageMessage);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No published tree")).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the failure up, retrying, until Retry answers", async () => {
    server.use(
      http.get(treePath, () =>
        HttpResponse.json(
          { error: outageMessage, code: "service_unavailable" },
          { status: 503 },
        ),
      ),
    );

    render(<BacterialPhylogenyPanel taxonId={562} taxonName="Escherichia coli" />, {
      wrapper: createQueryClientWrapper(),
    });

    const alert = await screen.findByRole("alert");

    let releaseRetry: () => void = () => undefined;
    server.use(
      http.get(treePath, async () => {
        await new Promise<void>((resolve) => {
          releaseRetry = resolve;
        });
        return HttpResponse.json({ filename: null });
      }),
    );
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    // The failure stays up instead of going back to the loading skeleton.
    expect(
      await within(alert).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(alert).toHaveTextContent(outageMessage);
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();

    act(() => {
      releaseRetry();
    });

    expect(await screen.findByText("No published tree")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
