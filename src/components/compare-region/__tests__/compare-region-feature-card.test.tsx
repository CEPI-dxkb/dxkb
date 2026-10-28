import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createRef, useState } from "react";
import { densitySpecs } from "@/lib/compare-region/density";
import {
  buildChartModel,
  type FeatureRef,
} from "@/lib/compare-region/families";
import { featureHref } from "@/lib/views/hrefs";
import { focusRow, mirroredRow } from "@/test-helpers/compare-region";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { FeatureCard } from "../compare-region-feature-card";

const model = buildChartModel([focusRow, mirroredRow], densitySpecs.comfortable);
const focusGene: FeatureRef = { rowIndex: 0, featureIndex: 1 };

/** fig|1.1.peg.2's `genome_feature` record, as `/api/data` answers it. */
const record = {
  feature_id: "PATRIC.1.1.NC_000913.CDS.900.1200.fwd",
  patric_id: "fig|1.1.peg.2",
  genome_id: "1.1",
  genome_name: "Escherichia coli str. K-12 substr. MG1655",
  taxon_id: 511145,
  annotation: "PATRIC",
  feature_type: "CDS",
  refseq_locus_tag: "b0002",
  protein_id: "NP_414543.1",
  accession: "NC_000913",
  start: 900,
  end: 1200,
  strand: "+",
  na_length: 301,
  aa_length: 100,
  product: "Focus protein",
  pgfam_id: "PGF_00000001",
  plfam_id: "PLF_561_00000001",
};

/** Answers member reads of `genome_feature` with `answer`, recording each request's query. */
function answerMember(
  answer: () => Response | Promise<Response>,
): URLSearchParams[] {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get("*/api/data/genome_feature", ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return answer();
    }),
  );
  return requests;
}

/** The card with its expanded state held, as the chart holds it. */
function Card({
  at = focusGene,
  onClose = () => undefined,
}: {
  at?: FeatureRef;
  onClose?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <FeatureCard
      ref={createRef()}
      model={model}
      at={at}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onClose={onClose}
    />
  );
}

function renderCard(props: { at?: FeatureRef; onClose?: () => void } = {}) {
  return render(<Card {...props} />, { wrapper: createQueryClientWrapper() });
}

/** The card is placed by the chart; unplaced, it is hidden from the accessibility tree. */
function card(): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    '[aria-label="Feature details"]',
  );
  if (!element) throw new Error("no card");
  return element;
}

describe("FeatureCard", () => {
  it("starts hidden, until the chart places it on its gene", () => {
    answerMember(() => new Promise<Response>(() => undefined));
    renderCard();
    expect(card()).toHaveAttribute("data-offscreen");
    expect(card()).toHaveAttribute("role", "dialog");
  });

  it("opens with the tooltip's lines and the comparison's fields, then the record's", async () => {
    answerMember(() => HttpResponse.json({ row: record }));
    renderCard();
    const view = within(card());
    // The tooltip's lines.
    expect(view.getByText("900…1,200 (301 bp, +)")).toBeInTheDocument();
    expect(view.getByText("100% to the focus gene")).toBeInTheDocument();
    // From the comparison, before the record answers: only the sections it fills.
    expect(view.getByText("Loading the feature record…")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Genome", hidden: true })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: "Source", hidden: true }),
    ).not.toBeInTheDocument();
    expect(view.queryByText("None available")).not.toBeInTheDocument();

    // The record's own fields, in the detail panel's sections.
    expect(await view.findByText("b0002")).toBeInTheDocument();
    expect(view.getByText("NP_414543.1")).toBeInTheDocument();
    expect(view.getByText("PLF_561_00000001")).toBeInTheDocument();
    for (const section of ["Source", "Location", "Families"]) {
      expect(
        view.getByRole("button", { name: section, hidden: true }),
      ).toBeInTheDocument();
    }
    expect(
      view.queryByText("Loading the feature record…"),
    ).not.toBeInTheDocument();
    // The first line names the gene: the panel adds no title of its own.
    expect(view.queryByRole("heading", { hidden: true })).not.toBeInTheDocument();
  });

  it("reads the gene's record by its BRC ID through /api/data", async () => {
    const requests = answerMember(() => HttpResponse.json({ row: record }));
    renderCard();
    await within(card()).findByText("b0002");
    expect(requests).toHaveLength(1);
    expect(requests[0].get("operation")).toBe("member");
    expect(requests[0].get("id")).toBe("fig|1.1.peg.2");
    expect(requests[0].get("idField")).toBe("patric_id");
  });

  it("offers the gene's sequences and links its page", async () => {
    answerMember(() => HttpResponse.json({ row: record }));
    renderCard();
    const view = within(card());
    expect(
      await view.findByRole("button", { name: "DNA FASTA", hidden: true }),
    ).toBeInTheDocument();
    expect(
      view.getByRole("button", { name: "Protein FASTA", hidden: true }),
    ).toBeInTheDocument();
    expect(
      view.getByRole("link", { name: "Open feature", hidden: true }),
    ).toHaveAttribute("href", featureHref("fig|1.1.peg.2"));
  });

  it("says so when no record matches, keeping the comparison's fields", async () => {
    answerMember(() => HttpResponse.json({ row: null }));
    renderCard();
    const view = within(card());
    expect(
      await view.findByText(
        "No BV-BRC feature record matches fig|1.1.peg.2. These details come from the comparison.",
      ),
    ).toBeInTheDocument();
    expect(view.getAllByText("Focus protein").length).toBeGreaterThan(0);
    expect(
      view.queryByRole("button", { name: "DNA FASTA", hidden: true }),
    ).not.toBeInTheDocument();
  });

  it("shows a failed read's own message with a Retry", async () => {
    let fail = true;
    answerMember(() =>
      fail
        ? HttpResponse.json(
            { error: "The Data API did not respond.", code: "upstream_timeout" },
            { status: 504 },
          )
        : HttpResponse.json({ row: record }),
    );
    const user = userEvent.setup();
    renderCard();
    const view = within(card());
    const alert = await view.findByRole("alert", { hidden: true });
    expect(alert).toHaveTextContent("Could not load the feature record");
    expect(alert).toHaveTextContent("The Data API did not respond.");

    fail = false;
    await user.click(
      within(alert).getByRole("button", { name: "Retry", hidden: true }),
    );
    expect(await view.findByText("b0002")).toBeInTheDocument();
    expect(view.queryByRole("alert", { hidden: true })).not.toBeInTheDocument();
  });

  it("reads nothing for a BLAST hit, which has no record", () => {
    // MSW is strict: a read would fail the test.
    renderCard({ at: { rowIndex: 0, featureIndex: 2 } });
    const view = within(card());
    expect(
      view.getByText(
        "This feature has no BV-BRC feature record. These details come from the comparison.",
      ),
    ).toBeInTheDocument();
    expect(
      view.queryByRole("link", { name: "Open feature", hidden: true }),
    ).not.toBeInTheDocument();
  });

  it("writes a minus-strand gene's span low to high, as the record does", () => {
    answerMember(() => new Promise<Response>(() => undefined));
    renderCard({ at: { rowIndex: 1, featureIndex: 0 } });
    const view = within(card());
    expect(view.getByText("4800")).toBeInTheDocument();
    expect(view.getByText("5100")).toBeInTheDocument();
  });

  it("collapses to the tooltip's lines and expands again", async () => {
    const requests = answerMember(() => HttpResponse.json({ row: record }));
    const user = userEvent.setup();
    renderCard();
    const view = within(card());
    await view.findByText("b0002");

    const collapse = view.getByRole("button", {
      name: "Collapse details",
      hidden: true,
    });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    await user.click(collapse);
    expect(view.queryByText("b0002")).not.toBeInTheDocument();
    expect(view.getByText("100% to the focus gene")).toBeInTheDocument();

    const expand = view.getByRole("button", {
      name: "Expand details",
      hidden: true,
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);
    // The record comes from the cache: no second read.
    expect(view.getByText("b0002")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
  });

  it("closes with its button and with Escape", async () => {
    answerMember(() => new Promise<Response>(() => undefined));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderCard({ onClose });
    const close = within(card()).getByRole("button", {
      name: "Close details",
      hidden: true,
    });
    await user.click(close);
    expect(onClose).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
