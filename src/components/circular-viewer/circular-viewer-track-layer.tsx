import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ringPath, type TrackDrawing } from "@/lib/circular-viewer/drawing";

const sweepReach = 40;

/**
 * Four mask passes, each later and more opaque, add up to a quarter, a half,
 * three quarters and all of the marks.
 */
const sweepPasses = [
  { opacity: 0.25, delay: "0ms" },
  { opacity: 1 / 3, delay: "50ms" },
  { opacity: 0.5, delay: "100ms" },
  { opacity: 1, delay: "150ms" },
] as const;

/**
 * Export can start mid-sweep, so the mask is `data-sweep`: an export drops it
 * and draws the marks whole.
 */
function SweepIn({ outerRadius, children }: { outerRadius: number; children: ReactNode }) {
  const id = useId();
  const [swept, setSwept] = useState(false);
  if (swept) return <g>{children}</g>;
  const reach = outerRadius + sweepReach;
  return (
    <>
      <mask
        id={id}
        maskUnits="userSpaceOnUse"
        x={-reach}
        y={-reach}
        width={2 * reach}
        height={2 * reach}
        className="mask-type-alpha"
        data-sweep=""
      >
        {sweepPasses.map((pass, index) => (
          <circle
            key={index}
            r={reach / 2}
            fill="none"
            stroke="currentColor"
            strokeWidth={reach}
            opacity={pass.opacity}
            pathLength={1}
            strokeDasharray="1 1"
            transform="rotate(-90)"
            className="animate-circular-track-sweep"
            style={{ "--sweep-delay": pass.delay } as CSSProperties}
            onAnimationEnd={
              index === sweepPasses.length - 1
                ? () => {
                    setSwept(true);
                  }
                : undefined
            }
          />
        ))}
      </mask>
      <g mask={`url(#${id})`}>{children}</g>
    </>
  );
}

function TrackMarks({ drawing }: { drawing: TrackDrawing }) {
  const { body } = drawing;
  if (body.kind === "pending") {
    return <path d={ringPath(drawing.ring)} className="fill-muted motion-safe:animate-pulse" />;
  }
  if (body.kind === "failed") {
    return <path d={ringPath(drawing.ring)} className="fill-destructive/20" />;
  }
  if (body.kind === "labels") {
    return (
      <SweepIn outerRadius={drawing.ring.outerRadius}>
        <g
          className="fill-(--tick-color) stroke-(--tick-color)"
          style={{ "--tick-color": drawing.foreground ?? "var(--muted-foreground)" } as CSSProperties}
        >
          {body.ticks.map((tick, index) => (
            <g key={index}>
              <line x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />
              {tick.label && (
                <text
                  x={tick.label.x}
                  y={tick.label.y}
                  transform={`rotate(${String(tick.label.rotate)} ${String(tick.label.x)} ${String(tick.label.y)})`}
                  textAnchor={tick.label.anchor}
                  dominantBaseline="central"
                  stroke="none"
                  className="text-3xs"
                >
                  {tick.label.text}
                </text>
              )}
            </g>
          ))}
        </g>
      </SweepIn>
    );
  }
  // A dark color stays as the attribute for the light theme and an export (it
  // drops `dark:` classes); a dark theme's class wins over it.
  return (
    <SweepIn outerRadius={drawing.ring.outerRadius}>
      {body.layers.map((layer, index) => {
        const dark =
          layer.darkColor === null ? undefined : ({ "--dark-color": layer.darkColor } as CSSProperties);
        return drawing.paint === "stroke" ? (
          <path
            key={index}
            d={layer.d}
            fill="none"
            stroke={layer.color ?? "#000000"}
            strokeWidth={0.5}
            className={dark ? "dark:stroke-(--dark-color)" : undefined}
            style={dark}
          />
        ) : (
          <path
            key={index}
            d={layer.d}
            fill={layer.color ?? "#0000FF"}
            className={dark ? "dark:fill-(--dark-color)" : undefined}
            style={dark}
          />
        );
      })}
    </SweepIn>
  );
}

/**
 * `display` stays the one mark of a hidden ring: a transition keeps it drawn
 * until its fade-out ends. An export drops the animation class, which would
 * start again on its copy.
 */
export function CircularTrackLayer({ drawing }: { drawing: TrackDrawing }) {
  const { ring, body } = drawing;
  const [mountedVisible] = useState(drawing.visible);
  const [toggled, setToggled] = useState(false);
  if (!toggled && drawing.visible !== mountedVisible) setToggled(true);
  const state = body.kind === "pending" ? "pending" : body.kind === "failed" ? "error" : "ready";
  return (
    <g
      data-track={drawing.id}
      data-state={state}
      data-inner-radius={ring.innerRadius.toFixed(1)}
      data-outer-radius={ring.outerRadius.toFixed(1)}
      display={drawing.visible ? undefined : "none"}
      className={toggled ? "animate-circular-track-toggle" : undefined}
    >
      {drawing.background !== null && drawing.backgroundPath !== "" && (
        <path d={drawing.backgroundPath} fill={drawing.background} />
      )}
      {drawing.grid.map((radius, index) => (
        <circle key={index} r={radius} fill="none" stroke={index === 1 ? "#666666" : "#AAAAAA"} strokeDasharray="1 3" />
      ))}
      <TrackMarks drawing={drawing} />
    </g>
  );
}
