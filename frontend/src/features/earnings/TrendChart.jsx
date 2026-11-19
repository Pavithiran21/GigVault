import { compactMoney } from '../../lib/money';
import { monthShort } from '../../lib/dates';

// Drawing area inside the 560 × 230 view box (the approved sample's chart).
const LEFT = 30;
const RIGHT = 540;
const TOP = 55;
const BASE = 205;
const MAX_LABELS = 6;

/**
 * Earned per month as a teal area chart on the dark hero (UI-UX.md "Earnings screen"):
 * one point per month, at most 6 month labels, the last month marked and labelled.
 * The amounts become numbers here only to place the points; the labels are rounded on purpose.
 */
export function TrendChart({ trend, currency, caption }) {
  const values = trend.map((point) => Number(point.earned));
  const max = Math.max(...values, 0) || 1;
  const step = trend.length > 1 ? (RIGHT - LEFT) / (trend.length - 1) : 0;
  const points = trend.map((point, index) => ({
    x: trend.length > 1 ? LEFT + index * step : (LEFT + RIGHT) / 2,
    y: BASE - (values[index] / max) * (BASE - TOP),
    month: point.month,
    earned: point.earned,
  }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${last.x.toFixed(1)} ${BASE} L${first.x.toFixed(1)} ${BASE} Z`;

  const labelEvery = Math.ceil(trend.length / MAX_LABELS);
  const lastLabel = `${monthShort(last.month)} ${compactMoney(last.earned, currency)}`;
  const labelWidth = lastLabel.length * 7.2 + 18;
  const labelX = Math.min(Math.max(last.x - labelWidth / 2, 4), 556 - labelWidth);
  const labelY = Math.max(last.y - 44, 4);
  const description = `${caption}: ${trend.map((point) => `${monthShort(point.month)} ${compactMoney(point.earned, currency)}`).join(', ')}`;

  return (
    <svg viewBox="0 0 560 230" width="100%" role="img" aria-label={description}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5eead4" stopOpacity=".55" />
          <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="rgba(255,255,255,.12)">
        <path d="M20 40H550M20 95H550M20 150H550" />
      </g>
      <path d={area} fill="url(#trend-fill)" />
      <path d={line} fill="none" stroke="#99f6e4" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="7" fill="#fff" stroke="#14b8a6" strokeWidth="3" />
      <rect x={labelX} y={labelY} width={labelWidth} height="26" rx="8" fill="#fff" />
      <text
        x={labelX + labelWidth / 2}
        y={labelY + 17}
        textAnchor="middle"
        fill="#0b4f4a"
        style={{ font: '600 12px Sora, sans-serif' }}
      >
        {lastLabel}
      </text>
      <g fill="rgba(255,255,255,.7)" textAnchor="middle" style={{ font: '12px "IBM Plex Sans", sans-serif' }}>
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text key={point.month} x={point.x} y="224">
              {monthShort(point.month)}
            </text>
          ) : null,
        )}
      </g>
    </svg>
  );
}
