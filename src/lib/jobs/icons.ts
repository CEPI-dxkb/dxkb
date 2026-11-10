import { createLucideIcon } from "lucide-react";

/**
 * Lucide's `circle-play` with the ring opened into a spinning arc while the triangle stays still.
 * `origin-center` resolves against the viewBox, so it turns around (12, 12); the reduced-motion
 * rule in `globals.css` stops it.
 */
export const CirclePlaySpinner = createLucideIcon({
  name: "circle-play-spinner",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z",
        key: "play",
      },
    ],
    [
      "path",
      {
        d: "M22 12a10 10 0 1 1-6.91-9.51",
        className: "origin-center animate-spin",
        key: "arc",
      },
    ],
  ],
});
