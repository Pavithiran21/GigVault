import { IconChartDonut4, IconDownload, IconPlus, IconUserPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { getDashboard } from '../../api/dashboard';
import { listGigs } from '../../api/gigs';
import { queryKeys } from '../../api/queryKeys';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { ErrorPanel, Skeleton } from '../../components/StatePanels';
import { PHONE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useSearchParamsState } from '../../hooks/useSearchParamsState';
import { shortPeriod } from '../../lib/period';
import { useCsvExport } from '../export/useCsvExport';
import { EarningsHero } from './EarningsHero';
import { IncomeDonut } from './IncomeDonut';
import { PeriodSwitch } from './PeriodSwitch';
import { PhoneEarnings } from './PhoneEarnings';
import { TopClients } from './TopClients';

const ONE_GIG = { size: 1 };

/** No gigs at all yet (UI-UX.md "States"): what to do first, instead of empty charts. */
function NoGigsYet() {
  return (
    <div className="card pad mx-auto max-w-md text-center">
      <Logo size={60} className="mx-auto" />
      <h3 className="mt-2 mb-1 text-[18px]">No gigs yet</h3>
      <p className="muted mt-0 mb-3.5 text-sm">Add a client, then your first gig. Earnings appear as payments come in.</p>
      <Link to="/clients?new=1" className="btn btn-teal">
        <IconUserPlus size={18} aria-hidden="true" /> Add a client
      </Link>
    </div>
  );
}

/**
 * Earnings, the home page and the signature feature (UI-UX.md screen 5): every total comes from
 * the backend's decimal aggregation (GET /dashboard) and is shown exactly as it arrives.
 * The period lives in the URL (?period=month, or custom with from and to; Year by default).
 * A phone shows the year summary instead (screen 23).
 */
export function EarningsPage() {
  usePageTitle('Earnings');
  const navigate = useNavigate();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [params, update] = useSearchParamsState(['period', 'from', 'to']);
  const { exportCsv, pending: exporting } = useCsvExport();

  let period = ['month', 'custom'].includes(params.period) ? params.period : 'year';
  if (period === 'custom' && !(params.from && params.to)) {
    period = 'year';
  }
  if (isPhone) {
    period = 'year';
  }
  const dashboardParams = period === 'custom' ? { period, from: params.from, to: params.to } : { period };

  const gigsQuery = useQuery({ queryKey: queryKeys.gigs.list(ONE_GIG), queryFn: () => listGigs(ONE_GIG) });
  // No placeholder data: a new period shows the "Adding up your earnings…" skeleton until its own
  // totals arrive, never the previous period's numbers under the new tab, and Export CSV (which
  // uses the period on screen) stays disabled until then.
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(dashboardParams),
    queryFn: () => getDashboard(dashboardParams),
  });
  const dashboard = dashboardQuery.data;
  const noGigs = gigsQuery.data?.totalItems === 0;

  if (isPhone) {
    if (noGigs) return <NoGigsYet />;
    if (dashboardQuery.isError) return <ErrorPanel title="Couldn't add up your earnings" onRetry={() => dashboardQuery.refetch()} />;
    if (!dashboard) return <Skeleton className="card pad" label="Adding up your earnings…" />;
    return <PhoneEarnings dashboard={dashboard} />;
  }

  const hasIncome = dashboard && dashboard.paymentCount > 0;

  return (
    <>
      <div className="head">
        <h2>Earnings</h2>
        {!noGigs && (
          <>
            <PeriodSwitch
              period={period}
              from={dashboard?.period.start ?? ''}
              to={dashboard?.period.end ?? ''}
              panelId="earnings-panel"
              onChange={(changes) => update(changes)}
            />
            <Button
              className="btn btn-line"
              pending={exporting}
              disabled={!dashboard}
              onClick={() => exportCsv({ from: dashboard.period.start, to: dashboard.period.end })}
            >
              {!exporting && <IconDownload size={18} aria-hidden="true" />} Export CSV
            </Button>
            <button type="button" className="btn btn-teal" onClick={() => navigate('/gigs/new')}>
              <IconPlus size={18} aria-hidden="true" /> New gig
            </button>
          </>
        )}
      </div>

      {noGigs && <NoGigsYet />}
      {!noGigs && dashboardQuery.isError && (
        <ErrorPanel title="Couldn't add up your earnings" onRetry={() => dashboardQuery.refetch()} />
      )}
      {!noGigs && dashboardQuery.isPending && <Skeleton className="card pad" label="Adding up your earnings…" />}
      {!noGigs && dashboard && (
        <>
          <EarningsHero dashboard={dashboard} panelId="earnings-panel" labelledBy={`period-${period}`} />
          {hasIncome ? (
            <div className="dash2">
              <IncomeDonut dashboard={dashboard} caption={shortPeriod(dashboard.period)} />
              <TopClients dashboard={dashboard} />
            </div>
          ) : (
            <div className="card pad flex items-center gap-3">
              <IconChartDonut4 size={26} className="shrink-0 text-teal-700" aria-hidden="true" />
              <div>
                <b className="text-ink">No income in this period</b>
                <div className="muted text-sm">
                  The donut and Top clients fill in as payments arrive. Outstanding always shows what is owed today.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
