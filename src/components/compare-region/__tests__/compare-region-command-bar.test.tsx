import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  defaultCompareRegionSettings,
  type CompareRegionSettings,
} from "@/lib/compare-region/contract";
import {
  CommandBar,
  type CommandBarProps,
} from "../compare-region-command-bar";
import type { ZoomControls } from "../compare-region-zoom-controls";
import { useCompareRegionSettings } from "../use-compare-region-settings";

// The real selector reads the session and searches the workspace (MSW is
// strict). The stub is an input the bar's "Genome group" / "Feature group"
// label names through `id`, and typing a path picks it. Like the real one,
// it keeps its own text, which only a fresh mount starts over.
vi.mock("@/components/workspace/workspace-object-selector", async () => {
  const { useState } = await vi.importActual<typeof import("react")>("react");
  return {
    WorkspaceObjectSelector: function SelectorStub({
      id,
      value,
      disabled,
      placeholder,
      onObjectSelect,
    }: {
      id?: string;
      value?: string;
      disabled?: boolean;
      placeholder?: string;
      onObjectSelect?: (object: { path: string }) => void;
    }) {
      const [text, setText] = useState(value ?? "");
      return (
        <input
          id={id}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => {
            setText(event.target.value);
            onObjectSelect?.({ path: event.target.value });
          }}
        />
      );
    },
  };
});

const groupPath = "/u@bvbrc/home/Genome Groups/G1";

interface BarProps extends Partial<Omit<CommandBarProps, "settings">> {
  applied?: CompareRegionSettings;
  onApply?: (settings: CompareRegionSettings) => void;
}

/** The bar over the real draft hook, as the panel will mount it. */
function Bar({
  applied = defaultCompareRegionSettings,
  onApply = () => undefined,
  busy = false,
  signedIn = true,
  zoom = null,
  onExport = null,
}: BarProps) {
  const settings = useCompareRegionSettings(applied, onApply);
  return (
    <CommandBar
      settings={settings}
      busy={busy}
      signedIn={signedIn}
      zoom={zoom}
      onExport={onExport}
    />
  );
}

/**
 * Renders the bar, then lets Base UI's slider thumb measure itself (it does
 * so in a microtask after mount) inside act.
 */
async function renderBar(props: BarProps = {}) {
  const result = render(<Bar {...props} />);
  await act(() => Promise.resolve());
  return result;
}

function zoomAt(
  level: number,
  limits: Pick<ZoomControls, "canZoomIn" | "canZoomOut">,
): ZoomControls {
  return { level, maxZoom: 20, ...limits, zoomBy: vi.fn(), fit: vi.fn() };
}

function genomesTrigger() {
  return screen.getByRole("button", { name: /^Genomes: / });
}

describe("CommandBar", () => {
  it("labels every setting", async () => {
    await renderBar();

    for (const label of [
      "Region size",
      "Number of genomes",
      "Method",
      "Genomes",
      "Zoom",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(
      screen.getByRole("combobox", { name: "Region size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Number of genomes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Method" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PGfam" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", {
        name: "Genomes: Reference & representative",
      }),
    ).toBeInTheDocument();
  });

  it("sets the unpressed method in text that reads at 4.5:1 on the muted pill", async () => {
    await renderBar();
    // `muted-foreground` on `muted` is 3.7:1 in the light themes;
    // `foreground/70` clears 4.5:1 in all six (theme-contrast.test.ts).
    const unpressed = screen.getByRole("button", { name: "PLfam" });
    expect(unpressed).toHaveClass("text-foreground/70", "hover:text-foreground");
    expect(unpressed).not.toHaveClass("text-muted-foreground");
  });

  it("offers the workspace groups disabled when signed out", async () => {
    const user = userEvent.setup();
    await renderBar({ signedIn: false });

    await user.click(genomesTrigger());

    expect(
      await screen.findByRole("menuitemradio", { name: "Selected genome group" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "Selected feature group" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("Sign in to use your workspace groups"),
    ).toBeInTheDocument();
  });

  it("cannot apply a group source while signed out, only a public one", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn<(settings: CompareRegionSettings) => void>();
    // A group URL opened signed out (or the session ran out).
    await renderBar({
      signedIn: false,
      onApply,
      applied: {
        ...defaultCompareRegionSettings,
        filter: "genomeGroup",
        group: groupPath,
      },
    });
    const update = screen.getByRole("button", { name: "Update" });

    await user.click(screen.getByRole("combobox", { name: "Number of genomes" }));
    await user.click(await screen.findByRole("option", { name: "20 genomes" }));
    expect(update).toBeDisabled();

    await user.click(genomesTrigger());
    await user.click(
      await screen.findByRole("menuitemradio", { name: "All genomes" }),
    );
    expect(update).toBeEnabled();
    await user.click(update);
    expect(onApply).toHaveBeenCalledWith({
      ...defaultCompareRegionSettings,
      genomes: 20,
      filter: "all",
      group: null,
    });
  });

  it("applies a picked genome group", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn<(settings: CompareRegionSettings) => void>();
    await renderBar({ onApply });

    await user.click(genomesTrigger());
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Selected genome group" }),
    );

    const picker = await screen.findByLabelText("Genome group");
    const update = screen.getByRole("button", { name: "Update" });
    expect(update).toBeDisabled();

    await user.type(picker, groupPath);
    expect(genomesTrigger()).toHaveAccessibleName("Genomes: Genome group: G1");
    await user.click(update);

    expect(onApply).toHaveBeenCalledWith({
      ...defaultCompareRegionSettings,
      filter: "genomeGroup",
      group: groupPath,
    });
  });

  it("labels the feature group picker once that source is chosen", async () => {
    const user = userEvent.setup();
    await renderBar();
    await user.click(genomesTrigger());
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Selected genome group" }),
    );
    await user.type(await screen.findByLabelText("Genome group"), groupPath);

    await user.click(genomesTrigger());
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Selected feature group" }),
    );

    // A fresh selector: the genome group's text does not carry over.
    const picker = await screen.findByLabelText("Feature group");
    expect(picker).toHaveAttribute("placeholder", "Choose a feature group…");
    expect(picker).toHaveValue("");
    expect(screen.queryByLabelText("Genome group")).not.toBeInTheDocument();
    expect(genomesTrigger()).toHaveAccessibleName(
      "Genomes: Selected feature group",
    );

    // Back again, the genome group's selector opens on its own pick.
    await user.click(genomesTrigger());
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Selected genome group" }),
    );
    expect(await screen.findByLabelText("Genome group")).toHaveValue(groupPath);
  });

  it("applies a changed number of genomes on Update", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn<(settings: CompareRegionSettings) => void>();
    await renderBar({ onApply });
    const update = screen.getByRole("button", { name: "Update" });
    expect(update).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Number of genomes" }));
    await user.click(await screen.findByRole("option", { name: "20 genomes" }));
    expect(onApply).not.toHaveBeenCalled();
    await user.click(update);

    expect(onApply).toHaveBeenCalledWith({
      ...defaultCompareRegionSettings,
      genomes: 20,
      filter: "reference",
      group: null,
    });
  });

  it("disables zoom and export while there is no chart", async () => {
    await renderBar({ zoom: null, onExport: null });

    for (const name of ["Zoom out", "Zoom in", "Fit the whole region", "Export SVG"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    // Base UI hides an edge-aligned thumb until it is measured, which jsdom
    // never does, and a hidden element computes no name: find the only slider.
    expect(screen.getByRole("slider", { hidden: true })).toBeDisabled();
  });

  it("disables each zoom button at its limit", async () => {
    const user = userEvent.setup();
    const whole = zoomAt(1, { canZoomOut: false, canZoomIn: true });
    const { rerender } = await renderBar({ zoom: whole });

    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Fit the whole region" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
    expect(screen.getByText("1.0×")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(whole.zoomBy).toHaveBeenCalledWith(1.5);

    rerender(<Bar zoom={zoomAt(20, { canZoomOut: true, canZoomIn: false })} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    expect(screen.getByText("20×")).toBeInTheDocument();
  });

  it("zooms out, fits and exports through the chart's controls", async () => {
    const user = userEvent.setup();
    const zoom = zoomAt(3, { canZoomOut: true, canZoomIn: true });
    const onExport = vi.fn<() => void>();
    await renderBar({ zoom, onExport });

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(zoom.zoomBy).toHaveBeenCalledWith(1 / 1.5);
    await user.click(screen.getByRole("button", { name: "Fit the whole region" }));
    expect(zoom.fit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Export SVG" }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("reads the slider out as the zoom, not its position", async () => {
    const { rerender } = await renderBar({
      zoom: zoomAt(2, { canZoomOut: true, canZoomIn: true }),
    });
    const slider = screen.getByRole("slider", { hidden: true });
    expect(slider).toHaveAttribute("aria-valuetext", "2.0×");
    rerender(<Bar zoom={zoomAt(20, { canZoomOut: true, canZoomIn: false })} />);
    expect(slider).toHaveAttribute("aria-valuetext", "20×");
  });

  it("zooms to the slider's position on a log scale", async () => {
    const user = userEvent.setup();
    const zoom = zoomAt(2, { canZoomOut: true, canZoomIn: true });
    await renderBar({ zoom });
    const slider = screen.getByRole("slider", { hidden: true });
    act(() => {
      slider.focus();
    });

    // The slider's 0–100 runs over log(zoom): 100 is 20×, 0 is 1×, from 2×.
    await user.keyboard("{End}");
    expect(zoom.zoomBy).toHaveBeenLastCalledWith(20 ** (100 / 100) / 2);
    await user.keyboard("{Home}");
    expect(zoom.zoomBy).toHaveBeenLastCalledWith(20 ** (0 / 100) / 2);
  });

  it("disables every setting and Update while a request is in flight", async () => {
    const user = userEvent.setup();
    const applied: CompareRegionSettings = {
      ...defaultCompareRegionSettings,
      filter: "genomeGroup",
      group: groupPath,
    };
    const { rerender } = await renderBar({ applied });
    expect(genomesTrigger()).toHaveAccessibleName("Genomes: Genome group: G1");
    // A change first, so Update is disabled by `busy` and not for want of one.
    await user.click(screen.getByRole("combobox", { name: "Number of genomes" }));
    await user.click(await screen.findByRole("option", { name: "20 genomes" }));
    expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();

    rerender(<Bar applied={applied} busy />);

    for (const name of ["Region size", "Number of genomes"]) {
      expect(screen.getByRole("combobox", { name })).toBeDisabled();
    }
    for (const name of ["PGfam", "PLfam", "Update"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(genomesTrigger()).toBeDisabled();
    expect(screen.getByLabelText("Genome group")).toBeDisabled();
  });
});
