import { render, screen } from "@testing-library/react";
import { ZoomableImage } from "../zoomable-image";

describe("ZoomableImage", () => {
  it("shows the image with its zoom controls and toolbar once the zoom frame loads", async () => {
    render(
      <ZoomableImage
        src="/api/workspace/view/user/photo.png"
        alt="photo.png"
        toolbarLeading={<span>Mode</span>}
      />,
    );

    expect(await screen.findByTitle("Zoom in")).toBeInTheDocument();
    expect(screen.getByTitle("Zoom out")).toBeInTheDocument();
    expect(screen.getByTitle("Reset")).toBeInTheDocument();
    expect(screen.getByText("Mode")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "photo.png" })).toHaveAttribute(
      "src",
      "/api/workspace/view/user/photo.png",
    );
  });
});
