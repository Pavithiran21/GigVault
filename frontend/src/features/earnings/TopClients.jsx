import { Link, useNavigate } from 'react-router';
import { ClientAvatar } from '../../components/Avatar';
import { formatMoney, toCents } from '../../lib/money';

/** Top clients (UI-UX.md "Earnings screen"): up to 5, paid in the period and owed today. A row opens the client. */
export function TopClients({ dashboard }) {
  const navigate = useNavigate();
  const { currency } = dashboard;
  return (
    <section className="card overflow-hidden" aria-labelledby="top-clients-title">
      <div className="ch px-4 pt-4">
        <h3 id="top-clients-title">Top clients</h3>
        <Link className="link text-[13px]" to="/clients">
          All clients
        </Link>
      </div>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Owed</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.topClients.map((client) => (
              <tr
                key={client.clientId}
                className="row-click"
                onClick={(event) => {
                  if (!event.target.closest('a')) navigate(`/clients/${client.clientId}`);
                }}
              >
                <td>
                  <div className="flex items-center gap-2">
                    <ClientAvatar id={client.clientId} name={client.name} />
                    <Link className="name" to={`/clients/${client.clientId}`}>
                      {client.name}
                    </Link>
                  </div>
                </td>
                <td className="rs text-right whitespace-nowrap">{formatMoney(client.paid, currency)}</td>
                <td className={`rs text-right whitespace-nowrap ${toCents(client.owed) > 0n ? 'text-amber' : 'muted'}`}>
                  {formatMoney(client.owed, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
