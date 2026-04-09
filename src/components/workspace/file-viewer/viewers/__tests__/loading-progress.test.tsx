import { render, screen } from "@testing-library/react";
import { LoadingProgress } from "../loading-progress";

describe("LoadingProgress", () => {
  it("shows percentage when totalBytes is provided", () => {
    render(<LoadingProgress bytesLoaded={512} totalBytes={1024} />);
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("calculates percentage correctly", () => {
    render(<LoadingProgress bytesLoaded={750} totalBytes={1000} />);
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it("caps percentage at 100%", () => {
    render(<LoadingProgress bytesLoaded={2000} totalBytes={1000} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("does not show percentage when totalBytes is null", () => {
    render(<LoadingProgress bytesLoaded={512} totalBytes={null} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("does not show percentage when totalBytes is 0", () => {
    render(<LoadingProgress bytesLoaded={0} totalBytes={0} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows total when totalBytes is provided", () => {
    render(<LoadingProgress bytesLoaded={512} totalBytes={2048} />);
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it("does not show total when totalBytes is null", () => {
    render(<LoadingProgress bytesLoaded={512} totalBytes={null} />);
    // Should only show bytesLoaded, no " / "
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });
});
