vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}));

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import type { TrackData } from "@/lib/circular-viewer/drawing";
import { defaultTracks } from "@/lib/circular-viewer/tracks";
import { maxUserFileBytes, maxUserTrackRows } from "@/lib/circular-viewer/user-track";
import { CircularViewerTrackList, type TrackError } from "../circular-viewer-track-list";
import { CustomTrackForm } from "../custom-track-form";
import { TrackColorPicker } from "../track-color-picker";
import { UserTrackForm } from "../user-track-form";

describe("CircularViewerTrackList", () => {
  const tracks = defaultTracks();
  const vfError = new Error("The BV-BRC data service is unavailable (HTTP 503).");
  const data = new Map<string, TrackData>([
    ["amr", { status: "ready", items: { kind: "features", features: [], truncated: false } }],
    ["vf", { status: "error", error: vfError }],
  ]);

  it("toggles and removes a track, and offers neither for the contig track", async () => {
    const dispatch = vi.fn();
    render(
      <CircularViewerTrackList tracks={tracks} data={data} gcWindowSize={2000} dispatch={dispatch} errors={new Map()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Hide CDS - FWD" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "toggle", id: "cds-forward" });
    await userEvent.click(screen.getByRole("button", { name: "Remove CDS - FWD" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "remove", id: "cds-forward" });
    expect(screen.queryByRole("button", { name: "Remove Contigs/Chromosomes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide Contigs/Chromosomes" })).toBeNull();
  });

  it("says an empty track found nothing and shows a failed track's message with a retry", async () => {
    const retry = vi.fn();
    const errors = new Map<string, TrackError>([["vf", { error: vfError, isFetching: false, retry }]]);
    render(
      <CircularViewerTrackList tracks={tracks} data={data} gcWindowSize={undefined} dispatch={vi.fn()} errors={errors} />,
    );
    expect(within(screen.getByRole("listitem", { name: "AMR Genes" })).getByText("None found")).toBeInTheDocument();
    const vf = screen.getByRole("listitem", { name: "VF Genes" });
    expect(within(vf).getByRole("alert")).toHaveTextContent("The BV-BRC data service is unavailable (HTTP 503).");
    await userEvent.click(within(vf).getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed track's message while its retry runs", () => {
    const pending = new Map<string, TrackData>([["vf", { status: "pending" }]]);
    const errors = new Map<string, TrackError>([["vf", { error: vfError, isFetching: true, retry: vi.fn() }]]);
    render(
      <CircularViewerTrackList tracks={tracks} data={pending} gcWindowSize={undefined} dispatch={vi.fn()} errors={errors} />,
    );
    const vf = screen.getByRole("listitem", { name: "VF Genes" });
    expect(vf).toHaveTextContent("The BV-BRC data service is unavailable (HTTP 503).");
    expect(within(vf).getByRole("button", { name: "Retrying…" })).toBeDisabled();
    expect(within(vf).queryByRole("status", { name: "Loading" })).toBeNull();
    // A track with no answer yet shows the spinner.
    expect(within(screen.getByRole("listitem", { name: "AMR Genes" })).getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("labels the visibility toggle with its action, not a pressed state", () => {
    const hidden = tracks.map((track) => (track.id === "amr" ? { ...track, visible: false } : track));
    render(
      <CircularViewerTrackList tracks={hidden} data={data} gcWindowSize={undefined} dispatch={vi.fn()} errors={new Map()} />,
    );
    const show = screen.getByRole("button", { name: "Show AMR Genes" });
    expect(show).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Hide VF Genes" })).not.toHaveAttribute("aria-pressed");
  });

  it("shows a track's description from the keyboard and gives it to screen readers", async () => {
    const gcOnly = tracks.filter((track) => track.id === "gc-content");
    render(
      <CircularViewerTrackList tracks={gcOnly} data={data} gcWindowSize={2000} dispatch={vi.fn()} errors={new Map()} />,
    );
    const description = "GC Content - window size: 2000 nt, plot range: 0 - 1";
    const title = screen.getByText("GC Content", { selector: "[tabindex='0']" });
    expect(title).toHaveAccessibleDescription(description);
    // Tab past the two color swatches to the title.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(title).toHaveFocus();
    expect(await screen.findByText(description, { selector: "[data-slot='tooltip-content'], [data-slot='tooltip-content'] *" })).toBeVisible();
  });

  it("notes a track that hit the feature limit", () => {
    const truncated = new Map<string, TrackData>([
      ["cds-forward", { status: "ready", items: { kind: "features", truncated: true, features: [{
        featureId: "f1", accession: "NC_1", start: 1, end: 500, strand: "+", featureType: "CDS",
      }] } }],
    ]);
    render(
      <CircularViewerTrackList tracks={tracks} data={truncated} gcWindowSize={undefined} dispatch={vi.fn()} errors={new Map()} />,
    );
    expect(screen.getByRole("listitem", { name: "CDS - FWD" })).toHaveTextContent("First 25,000");
  });
});

describe("TrackColorPicker", () => {
  it("names what the swatch colors on hover, and still opens the picker on click", async () => {
    render(<TrackColorPicker label="GC Content background color" hint="Background color" color="#EBD4F4" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "GC Content background color" });
    await userEvent.hover(trigger);
    // Shown to sighted users only: screen readers hear the trigger's label.
    expect(await screen.findByText("Background color")).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(await screen.findByRole("textbox", { name: "GC Content background color, hex value" })).toBeInTheDocument();
  });

  it("applies a palette swatch and a typed hex value", async () => {
    const onChange = vi.fn();
    render(<TrackColorPicker label="GC Content background color" hint="Background color" color="#EBD4F4" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "GC Content background color" });
    // A 24px target (WCAG 2.5.8) around its 16px swatch.
    expect(trigger).toHaveClass("size-6");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("button", { name: "Use #FF0000" }));
    expect(onChange).toHaveBeenLastCalledWith("#FF0000");
    const hex = screen.getByRole("textbox", { name: "GC Content background color, hex value" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "#12345");
    expect(onChange).not.toHaveBeenCalledWith("#12345");
    await userEvent.type(hex, "6");
    expect(onChange).toHaveBeenLastCalledWith("#123456");
  });

  it("commits a drag on the picker once a frame, with its latest color", async () => {
    const frames: FrameRequestCallback[] = [];
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      const onChange = vi.fn();
      render(<TrackColorPicker label="AMR Genes color" hint="Track color" color="#FF0000" onChange={onChange} />);
      await userEvent.click(screen.getByRole("button", { name: "AMR Genes color" }));
      const hue = await screen.findByRole("slider", { name: "Hue" });
      // Frames the popover asked for before the drag are not the picker's.
      const before = frames.length;
      fireEvent.keyDown(hue, { key: "ArrowRight", keyCode: 39 });
      fireEvent.keyDown(hue, { key: "ArrowRight", keyCode: 39 });
      fireEvent.keyDown(hue, { key: "ArrowRight", keyCode: 39 });
      expect(onChange).not.toHaveBeenCalled();
      expect(frames).toHaveLength(before + 1);
      act(() => {
        frames[before](0);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      const hex = screen.getByRole("textbox", { name: "AMR Genes color, hex value" });
      expect(onChange).toHaveBeenCalledWith((hex as HTMLInputElement).value);
    } finally {
      request.mockRestore();
    }
  });

  it("shows the track's dark color in the swatch in a dark theme", () => {
    render(<TrackColorPicker label="Contigs/Chromosomes color" hint="Track color" color="#000F7D" darkColor="#9FA8FF" onChange={vi.fn()} />);
    const swatch = screen.getByRole("button", { name: "Contigs/Chromosomes color" }).firstElementChild;
    expect(swatch).toHaveClass("dark:bg-(--swatch-dark)");
    const style = (swatch as HTMLElement | null)?.style;
    expect([style?.getPropertyValue("--swatch"), style?.getPropertyValue("--swatch-dark")]).toEqual(["#000F7D", "#9FA8FF"]);
  });
});

describe("CustomTrackForm", () => {
  it("adds a track once type, strand and keyword are set", async () => {
    const onAdd = vi.fn();
    render(<CustomTrackForm onAdd={onAdd} />);
    const add = screen.getByRole("button", { name: "Add custom track" });
    expect(add).toBeDisabled();
    await userEvent.click(screen.getByRole("combobox", { name: "Feature type" }));
    await userEvent.click(await screen.findByRole("option", { name: "RNA" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Strand" }));
    await userEvent.click(await screen.findByRole("option", { name: "Reverse" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Keyword" }), " ribosomal ");
    await userEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith({ type: "RNA", strand: "reverse", keyword: "ribosomal" }, "");
  });

  it("adds from the inline + button's form with Enter, too", async () => {
    const onAdd = vi.fn();
    render(<CustomTrackForm onAdd={onAdd} />);
    // Icon-only beside the track name, named by its aria-label.
    const add = screen.getByRole("button", { name: "Add custom track" });
    expect(add).toHaveTextContent("");
    expect(add).toHaveAttribute("type", "submit");
    await userEvent.click(screen.getByRole("combobox", { name: "Feature type" }));
    await userEvent.click(await screen.findByRole("option", { name: "RNA" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Strand" }));
    await userEvent.click(await screen.findByRole("option", { name: "Reverse" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Keyword" }), "ribosomal");
    await userEvent.type(screen.getByRole("textbox", { name: "Track name (optional)" }), "Ribosomes{Enter}");
    expect(onAdd).toHaveBeenCalledWith({ type: "RNA", strand: "reverse", keyword: "ribosomal" }, "Ribosomes");
  });
});

describe("UserTrackForm", () => {
  const sequenceLengths = new Map([["NC_1", 1000]]);

  /** The hidden native input behind the "Choose file" button. */
  function fileInput(): HTMLInputElement {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    return input;
  }

  it("opens the file picker from a visible button and names the chosen file", async () => {
    render(<UserTrackForm onAdd={vi.fn()} sequenceLengths={sequenceLengths} />);
    const button = screen.getByRole("button", { name: "Data file Choose file" });
    expect(button).toHaveAccessibleDescription("No file chosen");
    // The native input is out of the tab order and the accessibility tree: the button stands for it.
    expect(fileInput()).toHaveAttribute("tabindex", "-1");
    expect(fileInput()).toHaveAttribute("aria-hidden", "true");
    const click = vi.spyOn(fileInput(), "click");
    await userEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
    // The label opens it too.
    await userEvent.click(screen.getByText("Data file"));
    expect(click).toHaveBeenCalledTimes(2);

    await userEvent.upload(fileInput(), new File(["NC_1\t1\t100\n"], "tiles.txt", { type: "text/plain" }));
    expect(button).toHaveAccessibleDescription("tiles.txt");
  });

  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.warning).mockClear();
  });

  async function addFile(contents: string | File, plot: string | null) {
    const onAdd = vi.fn();
    render(<UserTrackForm onAdd={onAdd} sequenceLengths={sequenceLengths} />);
    if (plot !== null) {
      await userEvent.click(screen.getByRole("combobox", { name: "Plot type" }));
      await userEvent.click(await screen.findByRole("option", { name: plot }));
    }
    const file =
      typeof contents === "string"
        ? new File([contents], "scores.tsv", { type: "text/tab-separated-values" })
        : contents;
    await userEvent.upload(fileInput(), file);
    await userEvent.click(screen.getByRole("button", { name: "Add user track" }));
    return onAdd;
  }

  it("parses the chosen file with the chosen plot type", async () => {
    const onAdd = await addFile("NC_1\t1\t100\t0.5\n", "Line plot");
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "line",
        expect.objectContaining({ items: [{ accession: "NC_1", start: 1, end: 100, score: 0.5 }] }),
        "scores.tsv",
        "",
      );
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("disables Choose file and Add while the file is read, adds once, and keeps a name typed meanwhile", async () => {
    let resolveText: (text: string) => void = () => undefined;
    const file = new File(["NC_1\t1\t100\n"], "tiles.txt", { type: "text/plain" });
    const readText = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveText = resolve;
        }),
    );
    file.text = readText;
    const onAdd = vi.fn();
    render(<UserTrackForm onAdd={onAdd} sequenceLengths={sequenceLengths} />);
    await userEvent.upload(fileInput(), file);
    await userEvent.click(screen.getByRole("button", { name: "Add user track" }));

    expect(screen.getByRole("button", { name: "Data file Choose file" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add user track" })).toBeDisabled();

    // Enter with the submit button disabled must not start a second read; the name input stays usable.
    const nameInput = screen.getByRole("textbox", { name: "Track name (optional)" });
    await userEvent.type(nameInput, "Mine{Enter}");
    expect(readText).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveText("NC_1\t1\t100\n");
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: "Data file Choose file" })).toBeEnabled();
    // The name typed during the read was not submitted, so it is kept.
    expect(nameInput).toHaveValue("Mine");
    // The submitted file was cleared, from the form and from the native input.
    expect(screen.getByRole("button", { name: "Data file Choose file" })).toHaveAccessibleDescription("No file chosen");
    expect(fileInput().value).toBe("");
  });

  it("skips rows whose accession is not in the genome, with a warning, and rescales without them", async () => {
    const onAdd = await addFile("NC_1\t1\t100\t0.5\nNC_9\t1\t100\t40\nNC_9\t5\t9\t2\n", "Histogram");
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "histogram",
        { items: [{ accession: "NC_1", start: 1, end: 100, score: 0.5 }], scale: { min: 0, max: 1 }, skipped: 0 },
        "scores.tsv",
        "",
      );
    });
    expect(toast.warning).toHaveBeenCalledWith(
      "Skipped 2 line(s) of scores.tsv that are not on a drawn sequence.",
    );
  });

  it("skips rows that start past the end of their sequence, with a warning of their own", async () => {
    const onAdd = await addFile("NC_1\t1\t100\nNC_1\t5000\t6000\nNC_9\t1\t5\n", null);
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "tiles",
        expect.objectContaining({ items: [{ accession: "NC_1", start: 1, end: 100, score: null }] }),
        "scores.tsv",
        "",
      );
    });
    expect(toast.warning).toHaveBeenCalledWith("Skipped 1 line(s) of scores.tsv that are not on a drawn sequence.");
    expect(toast.warning).toHaveBeenCalledWith("Skipped 1 line(s) of scores.tsv that start past the end of their sequence.");
  });

  it("says so when every row is past the end", async () => {
    const onAdd = await addFile("NC_1\t5000\t6000\n", null);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No line of scores.tsv starts within a drawn sequence of this genome.",
      );
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  const rows = (count: number, accession = "NC_1") => `${accession}\t1\t1\n`.repeat(count);

  it("refuses a file with more drawn rows than a track can show", async () => {
    const onAdd = await addFile(rows(maxUserTrackRows + 1), null);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "scores.tsv has 100,001 lines to draw, more than the 100,000 a track can show. Split the file or keep fewer lines.",
      );
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("adds a file of exactly the most rows, and does not count rows that are not drawn", async () => {
    const onAdd = await addFile(rows(maxUserTrackRows) + rows(5, "NC_9"), null);
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith("Skipped 5 line(s) of scores.tsv that are not on a drawn sequence.");
  });

  it("adds nothing when no row's accession is in the genome", async () => {
    const onAdd = await addFile("NC_9\t1\t100\n", null);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No line of scores.tsv starts within a drawn sequence of this genome.",
      );
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("says a scored plot needs a fourth column when the file has three", async () => {
    const onAdd = await addFile("NC_1\t1\t100\nNC_1\t200\t300\n", "Heatmap");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "User file format error: no line has an accession, start, end and score separated by tabs. A file of three columns can be shown as Tiles.",
      );
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("adds the readable lines of a mixed file and warns about the rest", async () => {
    const onAdd = await addFile("accession\tstart\tend\tscore\nNC_1\t1\t100\t0.5\nNC_1\t200\t300\n", "Line plot");
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "line",
        expect.objectContaining({ items: [{ accession: "NC_1", start: 1, end: 100, score: 0.5 }], skipped: 2 }),
        "scores.tsv",
        "",
      );
    });
    expect(toast.warning).toHaveBeenCalledWith("Skipped 2 line(s) of scores.tsv that could not be read.");
  });

  it("refuses a file larger than 20 MB without reading it", async () => {
    const file = new File(["NC_1\t1\t100\n"], "huge.txt", { type: "text/plain" });
    const text = vi.spyOn(file, "text");
    Object.defineProperty(file, "size", { value: maxUserFileBytes + 1 });
    const onAdd = await addFile(file, null);
    expect(toast.error).toHaveBeenCalledWith("User file format error: the file is larger than 20 MB.");
    expect(text).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows why a file could not be read", async () => {
    const file = new File([""], "locked.txt", { type: "text/plain" });
    vi.spyOn(file, "text").mockRejectedValue(new Error("The file is no longer readable."));
    const onAdd = await addFile(file, null);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not read locked.txt: The file is no longer readable.");
    });
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add user track" })).toBeEnabled();
  });

  it("cannot add a file before the genome's sequences are known", async () => {
    render(<UserTrackForm onAdd={vi.fn()} sequenceLengths={undefined} />);
    const file = new File(["NC_1\t1\t100\n"], "tiles.txt", { type: "text/plain" });
    await userEvent.upload(fileInput(), file);
    expect(screen.getByRole("button", { name: "Add user track" })).toBeDisabled();
  });
});
