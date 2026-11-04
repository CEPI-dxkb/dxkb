import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ringPath, type TrackDrawing } from "@/lib/circular-viewer/drawing";

/** Room past a ring's outer edge the sweep also uncovers: the position labels sit there. */
const sweepReach = 40;

/**
 * The sweep's soft edge: four passes of the mask, each a little later and
 * more opaque, which add up to a quarter, a half, three quarters and all of
 * the marks (`1 - (1 - a)(1 - b)…`). A mark the sweep reaches fades in over
 * the last pass's delay instead of appearing whole, even a lone one at
 * 12 o'clock, where the sweep starts.
 */
const sweepPasses = [
  { opacity: 0.25, delay: "0ms" },
  { opacity: 1 / 3, delay: "50ms" },
  { opacity: 0.5, delay: "100ms" },
  { opacity: 1, delay: "150ms" },
] as const;

/**
 * Drawn marks sweep into view clockwise from 12 o'clock, the genome's
 * direction, once: when they replace the pending ring (a new element, so the
 * animation starts). They show through an alpha mask whose circles, as wide as
 * the figure's radius, are drawn along their length (`pathLength` 1, a dash of
 * 1 shifted from 1 to 0). Once the last pass ends the mask goes, so a later
 * redraw (a color, a resize) does not replay it. Export is enabled once the
 * requests settle, which can be mid-sweep, so the mask is `data-sweep`: an
 * export drops it and draws the marks whole.
 * Under reduced motion the passes last 0.01 ms with no delay (globals.css), so
 * they end at once.
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
  // A layer with a dark color keeps its color as the attribute, which the light
  // theme and an export (it drops `dark:` classes) use; a dark theme's class wins over it.
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
 * One track's ring. Hidden tracks keep their ring, as in legacy, so the others do not move.
 *
 * Its eye button fades it out and back in (`animate-circular-track-toggle` in
 * globals.css). `display` stays the one mark of a hidden ring, set at once:
 * a transition keeps the ring drawn until its fade out ends. Only a ring whose
 * visibility changed since it mounted fades, so the figure's first paint, and
 * a track just added, show at once. An export drops the class (an `animate-*`
 * would start again on its copy), so it draws the ring at rest.
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
