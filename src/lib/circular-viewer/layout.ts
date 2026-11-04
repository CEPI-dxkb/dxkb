/**
 * Where the Circular Viewer draws: each sequence's arc around the circle
 * (legacy `SectionTrack.renderData`, its reference track) and each track's
 * ring (legacy `Viewer.addTrack`). Angles are radians in d3's convention,
 * which visx's `arc` and `radialLine` use: 0 at 12 o'clock, clockwise.
 * Legacy started its first sequence at 270° of SVG's angle, the same place.
 */

export const fullTurn = 2 * Math.PI;

/** Legacy `section_gap`: 0.3° after each sequence. */
export const contigGapRadians = (0.3 * Math.PI) / 180;

/**
 * The most of the circle the gaps may take. Legacy's fixed 0.3° left a
 * 1,000-sequence draft 60° for its data; here the gap narrows instead.
 */
const maxGapShare = 0.1;

/** Legacy `Viewer.trackMargin`: pixels between rings. */
export const trackMargin = 4;

/** The innermost ring ends no nearer the center than this share of the radius. */
const minInnerShare = 0.12;

export interface ContigArc {
  accession: string;
  length: number;
  startAngle: number;
  endAngle: number;
}

export interface GenomeLayout {
  contigs: readonly ContigArc[];
  byAccession: ReadonlyMap<string, ContigArc>;
  radiansPerBase: number;
  totalLength: number;
}

export function buildGenomeLayout(
  sequences: readonly { accession: string; length: number }[],
): GenomeLayout {
  const placed = sequences.filter((sequence) => sequence.length > 0);
  const totalLength = placed.reduce((sum, sequence) => sum + sequence.length, 0);
  const gap =
    placed.length === 0
      ? 0
      : Math.min(contigGapRadians, (fullTurn * maxGapShare) / placed.length);
  const radiansPerBase =
    totalLength > 0 ? (fullTurn - gap * placed.length) / totalLength : 0;
  let angle = 0;
  const contigs = placed.map((sequence) => {
    const startAngle = angle;
    const endAngle = startAngle + sequence.length * radiansPerBase;
    angle = endAngle + gap;
    return { accession: sequence.accession, length: sequence.length, startAngle, endAngle };
  });
  return {
    contigs,
    byAccession: new Map(contigs.map((contig) => [contig.accession, contig])),
    radiansPerBase,
    totalLength,
  };
}

/** The angle of 0-based `offset` on `accession`, clamped to it; undefined for a sequence not laid out. */
export function offsetAngle(
  layout: GenomeLayout,
  accession: string,
  offset: number,
): number | undefined {
  const contig = layout.byAccession.get(accession);
  if (contig === undefined) return undefined;
  return (
    contig.startAngle +
    Math.min(Math.max(offset, 0), contig.length) * layout.radiansPerBase
  );
}

/** Legacy `Viewer.resize`: the outer radius sits 7.5 px inside the smaller side. */
export function figureRadius(width: number, height: number): number {
  return Math.max(0, (Math.min(width, height) - 15) / 2);
}

export interface RingSpec {
  id: string;
  /** A share of the outer radius, as legacy's `trackWidth`. */
  widthFraction: number;
}

export interface Ring {
  id: string;
  innerRadius: number;
  outerRadius: number;
}

/** The most of the ring budget the margins may take before they narrow too. */
const maxMarginShare = 0.5;

/**
 * Legacy `Viewer.addTrack`: the first ring at the edge, each next one inside
 * the last, `trackMargin` apart. Where they would cross `minInnerShare` of
 * the radius (legacy drew negative radii), every ring narrows alike; where
 * the margins alone would take more than half of that room (a small figure
 * or many tracks), they narrow too. So every radius stays at or outside
 * `minInnerShare` of the radius, and rings never overlap.
 */
export function layoutRings(specs: readonly RingSpec[], outerRadius: number): Ring[] {
  const budget = Math.max(0, outerRadius * (1 - minInnerShare));
  const margin =
    specs.length === 0
      ? trackMargin
      : Math.min(trackMargin, (budget * maxMarginShare) / specs.length);
  const requested =
    specs.reduce((sum, spec) => sum + spec.widthFraction, 0) * outerRadius;
  const available = budget - specs.length * margin;
  const scale = requested > available ? available / requested : 1;
  let edge = outerRadius;
  return specs.map((spec) => {
    const outer = edge - margin;
    const inner = outer - spec.widthFraction * outerRadius * scale;
    edge = inner;
    return { id: spec.id, innerRadius: inner, outerRadius: outer };
  });
}

export interface PolarPoint {
  angle: number;
  radius: number;
}

/** An offset from the center (SVG axes, y down) in d3's polar convention, angle in [0, 2π). */
export function toPolar(dx: number, dy: number): PolarPoint {
  const angle = Math.atan2(dx, -dy);
  return { angle: angle < 0 ? angle + fullTurn : angle, radius: Math.hypot(dx, dy) };
}

export function toCartesian(angle: number, radius: number): { x: number; y: number } {
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}
