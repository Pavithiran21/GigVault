import { compactMoney } from '../../lib/money';
import { plural } from '../../lib/enums';

const COLOURS = ['#0b4f4a', '#0f766e', '#14b8a6', '#5eead4'];
const OTHERS_COLOUR = '#d3ecea';
const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * "Where your income came from" (UI-UX.md "Earnings screen"): up to 4 named clients and
 * "N other clients", with the backend's one-decimal shares. The ring is drawn from the shares;
 * they can add up to 99.9 or 100.1, as on any pie chart, while the amounts stay exact.
 */
export function IncomeDonut({ dashboard, caption }) {
  const { incomeShare, currency } = dashboard;
  const slices = incomeShare.clients.map((client, index) => ({
    key: client.clientId,
    label: client.name,
    share: client.share,
    colour: COLOURS[index % COLOURS.length],
  }));
  if (incomeShare.others) {
    slices.push({
      key: 'others',
      label: `${plural(incomeShare.others.clientCount, 'other client')}`,
      share: incomeShare.others.share,
      colour: OTHERS_COLOUR,
    });
  }

  // Each arc starts where the one before it ended (Number() is for drawing only).
  const arcs = [];
  let offset = 0;
  for (const slice of slices) {
    const length = (Number(slice.share) / 100) * CIRCUMFERENCE;
    arcs.push({ ...slice, dash: `${length.toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`, offset: -offset });
    offset += length;
  }
  const description = `Share of income ${caption}: ${slices.map((slice) => `${slice.label} ${slice.share} percent`).join(', ')}`;

  return (
    <section className="card pad" aria-labelledby="income-title">
      <div className="ch">
        <h3 id="income-title">Where your income came from</h3>
        <span className="muted text-[13px]">Paid {caption}</span>
      </div>
      <div className="flex flex-wrap items-center gap-5.5">
        <svg viewBox="0 0 140 140" width="170" role="img" aria-label={description}>
          <g transform="rotate(-90 70 70)" fill="none" strokeWidth="18">
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx="70"
                cy="70"
                r={RADIUS}
                stroke={arc.colour}
                strokeDasharray={arc.dash}
                strokeDashoffset={arc.offset.toFixed(1)}
              />
            ))}
          </g>
          <text x="70" y="66" textAnchor="middle" fill="#0b2b2b" style={{ font: '600 16px Sora, sans-serif' }}>
            {compactMoney(dashboard.earned, currency)}
          </text>
          <text x="70" y="84" textAnchor="middle" fill="#5f7474" style={{ font: '10px "IBM Plex Sans", sans-serif' }}>
            {plural(dashboard.clientCount, 'client')}
          </text>
        </svg>
        <div className="grid min-w-[200px] flex-1 gap-2.5 text-sm">
          {slices.map((slice) => (
            <div key={slice.key} className="lg">
              <i style={{ background: slice.colour }} />
              <span className="truncate">{slice.label}</span>
              <b className="rs">{slice.share}%</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
