const { test, expect } = require('@playwright/test');
const { failure, fieldsOf, json, newClient, newGig, newUser, pay, todayIn } = require('../../helpers/api');

// The dashboard's totals are summed by MongoDB on Decimal128 and must match a hand calculation to the cent.
// Every date here is fixed in the past, so nothing depends on the day the tests run.

/**
 * A: gig1 (agreed 1000.00) paid 300.00 on 15 Jan and 200.00 on 10 Mar; gig2 (500.50) paid 100.25 on 20 Mar
 * B: gig3 (800.00) paid 800.00 on 5 Mar
 * C: gig4 (50.00) no payments
 */
async function year2025(request) {
  const api = await newUser(request);
  const a = await newClient(api, 'Client A');
  const b = await newClient(api, 'Client B');
  const c = await newClient(api, 'Client C');
  const gig1 = await newGig(api, { clientId: a.id, title: 'A one', agreedAmount: '1000.00' });
  const gig2 = await newGig(api, { clientId: a.id, title: 'A two', agreedAmount: '500.50' });
  const gig3 = await newGig(api, { clientId: b.id, title: 'B one', agreedAmount: '800.00' });
  await newGig(api, { clientId: c.id, title: 'C one', agreedAmount: '50.00' });
  await json(await pay(api, gig1.id, '300.00', '2025-01-15'), 201);
  await json(await pay(api, gig1.id, '200.00', '2025-03-10'), 201);
  await json(await pay(api, gig2.id, '100.25', '2025-03-20'), 201);
  await json(await pay(api, gig3.id, '800.00', '2025-03-05'), 201);
  return { api, a, b, c };
}

test('a custom period adds up to the cent: earned, count, average per gig, best month and a trend with empty months', async ({ request }) => {
  const { api } = await year2025(request);
  const dashboard = await json(await api.get('/dashboard?period=custom&from=2025-01-01&to=2025-04-30'), 200);
  expect(dashboard.period).toEqual({ type: 'custom', start: '2025-01-01', end: '2025-04-30' });
  expect(dashboard).toMatchObject({ earned: '1400.25', paymentCount: 4, clientCount: 2, gigCount: 3, averagePerGig: '466.75', currency: 'INR' });
  expect(dashboard.trend).toEqual([
    { month: '2025-01', earned: '300.00' },
    { month: '2025-02', earned: '0.00' },
    { month: '2025-03', earned: '1100.25' },
    { month: '2025-04', earned: '0.00' },
  ]);
  expect(dashboard.bestMonth).toEqual({ month: '2025-03', earned: '1100.25' });
});

test('income share is a percentage with one decimal per client, and top clients show what each still owes', async ({ request }) => {
  const { api } = await year2025(request);
  const dashboard = await json(await api.get('/dashboard?period=custom&from=2025-01-01&to=2025-12-31'), 200);
  expect(dashboard.incomeShare.clients.map((client) => [client.name, client.earned, client.share])).toEqual([
    ['Client B', '800.00', '57.1'],
    ['Client A', '600.25', '42.9'],
  ]);
  expect(dashboard.incomeShare.others).toBeNull();
  expect(dashboard.topClients.map((client) => [client.name, client.paid, client.owed])).toEqual([
    ['Client B', '800.00', '0.00'],
    ['Client A', '600.25', '900.25'],
  ]);
});

test('what is outstanding is every gig today, whatever period is shown', async ({ request }) => {
  const { api } = await year2025(request);
  // 900.25 owed on A's two gigs and 50.00 on C's, so three gigs still owe money.
  for (const query of ['period=custom&from=2025-03-01&to=2025-03-31', 'period=custom&from=2020-01-01&to=2020-01-31']) {
    const dashboard = await json(await api.get(`/dashboard?${query}`), 200);
    expect(dashboard.outstanding).toEqual({ amount: '950.25', gigCount: 3 });
  }
});

test('the period includes its last day and leaves out the next one', async ({ request }) => {
  const api = await newUser(request);
  const gig = await newGig(api, { agreedAmount: '100.00' });
  await json(await pay(api, gig.id, '10.00', '2025-03-31'), 201);
  await json(await pay(api, gig.id, '20.00', '2025-04-01'), 201);
  const earned = async (from, to) => (await json(await api.get(`/dashboard?period=custom&from=${from}&to=${to}`), 200)).earned;
  expect(await earned('2025-03-01', '2025-03-31')).toBe('10.00');
  expect(await earned('2025-04-01', '2025-04-30')).toBe('20.00');
  expect(await earned('2025-03-31', '2025-04-01')).toBe('30.00');
});

test('a user with no payments gets zeros, empty lists, and this month and year in their own time zone', async ({ request }) => {
  const api = await newUser(request, { timeZone: 'Pacific/Kiritimati' });
  const dashboard = await json(await api.get('/dashboard?period=month'), 200);
  const today = todayIn('Pacific/Kiritimati');
  expect(dashboard.timeZone).toBe('Pacific/Kiritimati');
  expect(dashboard.period).toMatchObject({ type: 'month', start: `${today.slice(0, 7)}-01` });
  expect(dashboard).toMatchObject({ earned: '0.00', paymentCount: 0, averagePerGig: '0.00', bestMonth: null, topClients: [] });
  expect(dashboard.incomeShare).toEqual({ clients: [], others: null });
  expect(dashboard.thisMonth.month).toBe(today.slice(0, 7));
  expect(dashboard.thisYear.year).toBe(Number(today.slice(0, 4)));
  const year = await json(await api.get('/dashboard?period=year'), 200);
  expect(year.period).toMatchObject({ start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` });
});

test('a custom period needs both dates, in order, and at most five years', async ({ request }) => {
  const api = await newUser(request);
  expect(fieldsOf(await failure(await api.get('/dashboard?period=custom&to=2025-01-31'), 400, 'VALIDATION_FAILED'))).toContain('from');
  expect(fieldsOf(await failure(await api.get('/dashboard?period=custom&from=2025-01-31'), 400, 'VALIDATION_FAILED'))).toContain('to');
  expect(fieldsOf(await failure(await api.get('/dashboard?period=custom&from=2025-02-01&to=2025-01-01'), 400, 'VALIDATION_FAILED'))).toContain('to');
  await failure(await api.get('/dashboard?period=custom&from=2015-01-01&to=2025-01-01'), 400, 'VALIDATION_FAILED');
  await failure(await api.get('/dashboard?period=decade'), 400, 'VALIDATION_FAILED');
});

test('one user\'s payments never show in another user\'s dashboard', async ({ request }) => {
  const { api } = await year2025(request);
  const stranger = await newUser(request);
  const theirs = await json(await stranger.get('/dashboard?period=custom&from=2025-01-01&to=2025-12-31'), 200);
  expect(theirs).toMatchObject({ earned: '0.00', paymentCount: 0, outstanding: { amount: '0.00', gigCount: 0 } });
  expect((await json(await api.get('/dashboard?period=custom&from=2025-01-01&to=2025-12-31'), 200)).earned).toBe('1400.25');
});
