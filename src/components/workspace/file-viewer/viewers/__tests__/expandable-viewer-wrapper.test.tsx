import { render, screen, fireEvent, act } from "@testing-library/react";
import { ExpandableViewerWrapper } from "../expandable-viewer-wrapper";

describe("ExpandableViewerWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it("renders children inline by default", () => {
    render(
      <ExpandableViewerWrapper>
        <div data-testid="child">content</div>
      </ExpandableViewerWrapper>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("shows an expand button", () => {
    render(
      <ExpandableViewerWrapper>
        <div>content</div>
      </ExpandableViewerWrapper>,
    );
    expect(
      screen.getByRole("button", { name: "Expand to full screen" }),
    ).toBeInTheDocument();
  });

  it("renders fullscreen view when expand is clicked", () => {
    render(
      <ExpandableViewerWrapper title="Test Viewer">
        <div data-testid="child">content</div>
      </ExpandableViewerWrapper>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand to full screen" }),
    );

    // Child stays in the DOM (no unmount/remount)
    expect(screen.getByTestId("child")).toBeInTheDocument();
    // Title is shown in fullscreen header
    expect(screen.getByText("Test Viewer")).toBeInTheDocument();
    // Collapse button appears
    expect(
      screen.getByRole("button", { name: "Collapse" }),
    ).toBeInTheDocument();
    // Expand button is gone
    expect(
      screen.queryByRole("button", { name: "Expand to full screen" }),
    ).not.toBeInTheDocument();
  });

  it("collapses back to inline when collapse button is clicked", () => {
    render(
      <ExpandableViewerWrapper title="Test Viewer">
        <div data-testid="child">content</div>
      </ExpandableViewerWrapper>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand to full screen" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

    // Advance past the 200ms fade-out animation
    act(() => vi.advanceTimersByTime(200));

    // Back to inline: expand button visible, no title header
    expect(
      screen.getByRole("button", { name: "Expand to full screen" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Test Viewer")).not.toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("collapses on Escape key", () => {
    render(
      <ExpandableViewerWrapper title="Test Viewer">
        <div data-testid="child">content</div>
      </ExpandableViewerWrapper>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand to full screen" }),
    );
    fireEvent.keyDown(document, { key: "Escape" });

    // Advance past the 200ms fade-out animation
    act(() => vi.advanceTimersByTime(200));

    expect(
      screen.getByRole("button", { name: "Expand to full screen" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Test Viewer")).not.toBeInTheDocument();
  });

  it("calls onExpandChange(true) when expanding", () => {
    const onChange = vi.fn();
    render(
      <ExpandableViewerWrapper onExpandChange={onChange}>
        <div>content</div>
      </ExpandableViewerWrapper>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand to full screen" }),
    );

    // Advance past the rAF that fires the callback
    act(() => vi.advanceTimersByTime(50));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onExpandChange(false) when collapsing", () => {
    const onChange = vi.fn();
    render(
      <ExpandableViewerWrapper onExpandChange={onChange}>
        <div>content</div>
      </ExpandableViewerWrapper>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand to full screen" }),
    );
    act(() => vi.advanceTimersByTime(50));
    onChange.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    act(() => vi.advanceTimersByTime(250));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders without title in fullscreen header", () => {
    render(
      <ExpandableViewerWrapper>
        <div>content</div>
      </ExpandableViewerWrapper>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand to full screen" }),
    );

    // Collapse button still works without a title
    expect(
      screen.getByRole("button", { name: "Collapse" }),
    ).toBeInTheDocument();
  });
});
