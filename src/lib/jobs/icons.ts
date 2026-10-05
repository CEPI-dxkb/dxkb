import { createLucideIcon } from "lucide-react";

/**
 * Lucide's `circle-play` with the ring opened into a spinning arc, the way
 * `loader-circle` spins, while the play triangle stays still. Marks a job that
 * is running right now; static `CirclePlay` stands in where nothing is.
 *
 * The arc is the 10px ring with the same ~72° gap `loader-circle` leaves in its
 * 9px one. `origin-center` resolves against the SVG viewBox, so it turns
 * around (12, 12). The global reduced-motion rule in `globals.css` stops it.
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
