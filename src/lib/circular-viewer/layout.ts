/** Angles are radians in d3's convention (0 at 12 o'clock, clockwise). */

export const fullTurn = 2 * Math.PI;

export const contigGapRadians = (0.3 * Math.PI) / 180;

/** The gap narrows so a many-sequence draft keeps room for its data. */
const maxGapShare = 0.1;

export const trackMargin = 4;

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

export function figureRadius(width: number, height: number): number {
  return Math.max(0, (Math.min(width, height) - 15) / 2);
}

export interface RingSpec {
  id: string;
  widthFraction: number;
}

export interface Ring {
  id: string;
  innerRadius: number;
  outerRadius: number;
}

const maxMarginShare = 0.5;

/**
 * Where rings would cross `minInnerShare` of the radius, or the margins alone
 * would take over half the room, every ring narrows, so rings never overlap.
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

export function toPolar(dx: number, dy: number): PolarPoint {
  const angle = Math.atan2(dx, -dy);
  return { angle: angle < 0 ? angle + fullTurn : angle, radius: Math.hypot(dx, dy) };
}

export function toCartesian(angle: number, radius: number): { x: number; y: number } {
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}
