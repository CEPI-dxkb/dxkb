/**
 * GC content `(G + C) / length` and GC skew `(G - C) / (G + C)` in fixed
 * windows, as legacy `getGCContent` computed them in the browser (a window
 * with no G or C has skew 0). Run on the server, so a genome's sequence never
 * reaches the browser. Rounded to four decimals to keep the answer small.
 */
const lowerG = 103;
const lowerC = 99;

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function gcWindows(
  sequence: string,
  windowSize: number,
): { gc: number[]; skew: number[] } {
  const gc: number[] = [];
  const skew: number[] = [];
  for (let start = 0; start < sequence.length; start += windowSize) {
    const end = Math.min(start + windowSize, sequence.length);
    let g = 0;
    let c = 0;
    for (let index = start; index < end; index += 1) {
      // `| 0x20` lowercases an ASCII letter, so G and g compare alike.
      const code = sequence.charCodeAt(index) | 0x20;
      if (code === lowerG) g += 1;
      else if (code === lowerC) c += 1;
    }
    gc.push(round4((g + c) / (end - start)));
    skew.push(round4((g - c) / (g + c || 1)));
  }
  return { gc, skew };
}
