import { colors, edgeAlpha } from "@/lib/interactions/graph-theme";

const edgeOpacity = edgeAlpha / 255;

export function GraphLegend() {
  return (
    <svg
      width={200}
      height={135}
      className="text-sm [&_text]:fill-foreground"
      role="img"
      aria-label="Graph legend"
    >
      <circle cx={10} cy={11} r={10} fill={colors.microbial} />
      <text x={30} y={16}>
        Microbial protein
      </text>
      <circle cx={10} cy={39} r={10} fill={colors.host} />
      <text x={30} y={44}>
        Host protein
      </text>
      <circle cx={10} cy={67} r={10} fill={colors.selected} />
      <text x={30} y={72}>
        Selected
      </text>
      <line
        data-testid="predicted-interaction-swatch"
        x1={0}
        y1={95}
        x2={20}
        y2={95}
        strokeWidth={3}
        stroke={colors.edge}
        strokeOpacity={edgeOpacity}
      />
      <text x={30} y={100}>
        Predicted interaction
      </text>
      <line
        data-testid="experimental-interaction-swatch"
        x1={0}
        y1={123}
        x2={20}
        y2={123}
        strokeWidth={3}
        stroke={colors.edgeExperimental}
        strokeOpacity={edgeOpacity}
      />
      <text x={30} y={128}>
        Experimentally verified
      </text>
    </svg>
  );
}
