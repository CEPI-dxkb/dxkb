import { playTuck } from "../tuck";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reduce, media: query })),
  );
}

function animatedElement() {
  const element = document.createElement("div");
  const animate = vi.fn(() => ({}) as Animation);
  element.animate = animate;
  return { element, animate };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playTuck", () => {
  it("shrinks toward the tab and fades out, holding the tucked state", () => {
    stubReducedMotion(false);
    const { element, animate } = animatedElement();
    playTuck(element, { x: 400, y: 120.25 }, "minimize");

    expect(animate).toHaveBeenCalledTimes(1);
    const [frames, options] = animate.mock.calls[0] as unknown as [
      Keyframe[],
      KeyframeAnimationOptions,
    ];
    expect(frames.map((frame) => frame.opacity)).toEqual([1, 0.7, 0]);
    expect(frames[0]).toMatchObject({
      transform: "scale(1)",
      transformOrigin: "400.0px 120.3px",
      visibility: "visible",
    });
    expect(frames[2]).toMatchObject({
      transform: "scale(0.25)",
      visibility: "hidden",
    });
    expect(options).toMatchObject({ duration: 170, fill: "forwards" });
  });

  it("grows back out of the tab without holding a fill", () => {
    stubReducedMotion(false);
    const { element, animate } = animatedElement();
    playTuck(element, { x: 0, y: 0 }, "restore");

    const [frames, options] = animate.mock.calls[0] as unknown as [
      Keyframe[],
      KeyframeAnimationOptions,
    ];
    expect(frames.map((frame) => frame.opacity)).toEqual([0, 0.7, 1]);
    expect(options).toMatchObject({ duration: 220, fill: "none" });
  });

  it("does not move for people who ask for reduced motion", () => {
    stubReducedMotion(true);
    const { element, animate } = animatedElement();
    expect(playTuck(element, { x: 0, y: 0 }, "minimize")).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });
});
