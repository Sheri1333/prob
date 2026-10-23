import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/* Small hand-built SVG charts for the cabinet. Colours come from CSS
   tokens (see cabinet.css), so light and dark modes follow the theme. */

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export interface LinePoint {
  id: string;
  /** Short x label, e.g. a date. */
  label: string;
  value: number;
}

interface ScoreLineProps {
  points: LinePoint[];
  max: number;
  /** Gridline values, bottom to top. */
  ticks: number[];
  /** Caption for the hidden table and the tooltip value, e.g. "балл". */
  unit: string;
  height?: number;
  onPick?: (point: LinePoint) => void;
  formatValue?: (value: number) => string;
}

/** One series over attempts: 2px line, 10% wash, ringed dots, crosshair tooltip. */
export function ScoreLine({
  points,
  max,
  ticks,
  unit,
  height = 220,
  onPick,
  formatValue = (v) => String(v),
}: ScoreLineProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    const m = { top: 14, right: 44, bottom: 28, left: 36 };
    const w = Math.max(0, width - m.left - m.right);
    const h = height - m.top - m.bottom;
    const n = points.length;
    const x = (i: number) => m.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
    const y = (v: number) => m.top + h - (Math.min(max, Math.max(0, v)) / max) * h;
    return { m, w, h, x, y };
  }, [width, height, points.length, max]);

  if (points.length === 0) return null;
  const { m, h, x, y } = geo;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${m.top + h} L${x(0)},${m.top + h} Z`;
  const last = points.length - 1;

  // At most ~6 x labels, always first and last.
  const step = Math.max(1, Math.ceil(points.length / 6));
  const xLabels = points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i === 0 || i === last || (i % step === 0 && last - i >= step / 2));

  const pick = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || points.length === 0) return;
    const rel = clientX - el.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(i) - rel) < Math.abs(x(best) - rel)) best = i;
    }
    setHover(best);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") setHover((v) => Math.min(last, (v ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? last + 1) - 1));
    else if (e.key === "Enter" && hover !== null) onPick?.(points[hover]);
    else return;
    e.preventDefault();
  };

  const tip = hover !== null ? points[hover] : null;

  return (
    <div
      ref={wrapRef}
      className="chart"
      tabIndex={0}
      role="group"
      aria-label={`${unit}: ${points.map((p) => `${p.label} ${formatValue(p.value)}`).join(", ")}`}
      onPointerMove={(e: PointerEvent) => pick(e.clientX)}
      onPointerDown={(e: PointerEvent) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
      onBlur={() => setHover(null)}
      onKeyDown={onKey}
      onClick={() => tip && onPick?.(tip)}
      style={{ height, cursor: onPick ? "pointer" : undefined }}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line
                className="chart__grid"
                x1={m.left}
                x2={width - m.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text className="chart__tick" x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {xLabels.map(({ p, i }) => (
            <text
              key={p.id}
              className="chart__tick"
              x={x(i)}
              y={height - 8}
              textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === last ? "end" : "middle"}
            >
              {p.label}
            </text>
          ))}
          <path className="chart__area" d={area} />
          <path className="chart__line" d={line} />
          {tip && hover !== null && (
            <line className="chart__cross" x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + h} />
          )}
          {points.map((p, i) => (
            <circle
              key={p.id}
              className={`chart__dot${hover === i ? " is-hover" : ""}`}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 6 : 4.5}
            />
          ))}
          <text className="chart__end" x={x(last) + 10} y={y(points[last].value)} dy="0.32em">
            {formatValue(points[last].value)}
          </text>
        </svg>
      )}
      {tip && hover !== null && (
        <div
          className="chart__tip"
          style={{
            left: Math.min(Math.max(x(hover), 70), Math.max(70, width - 70)),
            top: y(tip.value),
          }}
        >
          <span>{tip.label}</span>
          <strong>
            {formatValue(tip.value)} {unit}
          </strong>
        </div>
      )}
      <table className="visually-hidden">
        <tbody>
          {points.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.label}</th>
              <td>
                {formatValue(p.value)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface StackPart {
  key: "correct" | "partial" | "wrong" | "skipped";
  label: string;
  value: number;
}

/** One horizontal bar of parts with 2px gaps, plus a legend carrying the numbers. */
export function StackBar({ parts }: { parts: StackPart[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return null;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="stack">
      <div className="stack__bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {shown.map((p) => (
          <span
            key={p.key}
            className={`stack__seg stack__seg--${p.key}`}
            style={{ flexGrow: p.value }}
            title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}
          />
        ))}
      </div>
      <ul className="stack__legend">
        {parts.map((p) => (
          <li key={p.key}>
            <i className={`stack__swatch stack__seg--${p.key}`} aria-hidden="true" />
            <span>{p.label}</span>
            <strong>{p.value}</strong>
            <em>{Math.round((p.value / total) * 100)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Labelled horizontal percentage bars (single series, no legend needed). */
export function PercentBars({
  rows,
}: {
  rows: Array<{ key: string; label: string; pct: number; note?: string; highlight?: boolean }>;
}) {
  return (
    <ul className="pbars">
      {rows.map((r) => (
        <li key={r.key} className={r.highlight ? "is-low" : ""}>
          <span className="pbars__label">{r.label}</span>
          <span className="pbars__track">
            <span style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} />
          </span>
          <span className="pbars__pct">{r.pct}%</span>
          {r.note && <span className="pbars__note">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}
