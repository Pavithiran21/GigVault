const { test, expect } = require('@playwright/test');
const { failure, fieldsOf, json, newClient, newGig, newUser, pay, todayIn } = require('../../helpers/api');

// The signature feature, part one: money is exact, a gig's status is worked out from its payments,
// and a gig can never be overpaid, even when payments arrive at the same moment.

test.describe('exact money', () => {
  test('ten payments of 0.10 add up to exactly 1.00 and the gig is paid', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '1.00' });
    for (let index = 0; index < 10; index += 1) await json(await pay(api, gig.id, '0.10'), 201);
    const after = await json(await api.get(`/gigs/${gig.id}`), 200);
    expect(after).toMatchObject({ agreedAmount: '1.00', receivedAmount: '1.00', outstanding: '0.00', paymentStatus: 'paid', paymentCount: 10 });
  });

  test('0.10 + 0.20 is exactly 0.30, in the gig and in the dashboard', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '0.30' });
    await json(await pay(api, gig.id, '0.10'), 201);
    await json(await pay(api, gig.id, '0.20'), 201);
    expect((await json(await api.get(`/gigs/${gig.id}`), 200)).paymentStatus).toBe('paid');
    const dashboard = await json(await api.get('/dashboard?period=custom&from=2025-01-01&to=2025-12-31'), 200);
    expect(dashboard.earned).toBe('0.30');
  });

  test('amounts must be text or a whole number: a JSON fraction, 3 decimals, zero, negative and words are refused', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '1000.00' });
    for (const bad of [12.5, '12.345', 0, '0.00', '-5', 'abc', '', true, '99999999999.00']) {
      const error = await failure(await pay(api, gig.id, bad), 400, 'VALIDATION_FAILED');
      expect(fieldsOf(error), JSON.stringify(bad)).toContain('amount');
    }
    // The agreed amount follows the same rule.
    await failure(await api.post('/gigs', { clientId: gig.clientId, title: 'x', agreedAmount: 99.5, startDate: '2025-01-01', dueDate: '2025-01-02' }), 400, 'VALIDATION_FAILED');
    // A whole number is fine and comes back with two decimals.
    expect((await json(await pay(api, gig.id, 100), 201)).payment.amount).toBe('100.00');
  });
});

test.describe('payment status is worked out, never typed in', () => {
  test('unpaid, then partly paid, then paid; deleting a payment moves it back', async ({ request }) => {
    const api = await newUser(request);
    // The status can't be sent: a "paid" in the body is ignored.
    const gig = await json(await api.post('/gigs', { clientId: (await newClient(api)).id, title: 'Poster', agreedAmount: '200.00', startDate: '2025-01-01', dueDate: '2025-01-31', paymentStatus: 'paid' }), 201);
    expect(gig).toMatchObject({ paymentStatus: 'unpaid', receivedAmount: '0.00', outstanding: '200.00' });

    const first = await json(await pay(api, gig.id, '50.00'), 201);
    expect(first.gig).toMatchObject({ paymentStatus: 'partly_paid', receivedAmount: '50.00', outstanding: '150.00' });
    const second = await json(await pay(api, gig.id, '150.00'), 201);
    expect(second.gig).toMatchObject({ paymentStatus: 'paid', outstanding: '0.00' });

    expect((await api.delete(`/payments/${second.payment.id}`)).status()).toBe(204);
    expect(await json(await api.get(`/gigs/${gig.id}`), 200)).toMatchObject({ paymentStatus: 'partly_paid', receivedAmount: '50.00', outstanding: '150.00' });
    expect((await api.delete(`/payments/${first.payment.id}`)).status()).toBe(204);
    expect((await json(await api.get(`/gigs/${gig.id}`), 200)).paymentStatus).toBe('unpaid');
    expect((await api.delete(`/payments/${first.payment.id}`)).status()).toBe(404);
  });

  test('the list filter by payment status finds the same gigs the status says', async ({ request }) => {
    const api = await newUser(request);
    const client = await newClient(api);
    const unpaid = await newGig(api, { clientId: client.id, title: 'A unpaid', agreedAmount: '10.00' });
    const partly = await newGig(api, { clientId: client.id, title: 'B partly', agreedAmount: '10.00' });
    const paid = await newGig(api, { clientId: client.id, title: 'C paid', agreedAmount: '10.00' });
    await json(await pay(api, partly.id, '3.33'), 201);
    await json(await pay(api, paid.id, '10.00'), 201);
    const titles = async (status) => (await json(await api.get(`/gigs?paymentStatus=${status}`), 200)).items.map((gig) => gig.id);
    expect(await titles('unpaid')).toEqual([unpaid.id]);
    expect(await titles('partly_paid')).toEqual([partly.id]);
    expect(await titles('paid')).toEqual([paid.id]);
  });
});

test.describe('a gig can never be overpaid', () => {
  test('a payment over what is still owed is a 422 that says how much is left', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '100.00' });
    await json(await pay(api, gig.id, '60.00'), 201);
    const error = await failure(await pay(api, gig.id, '40.01'), 422, 'PAYMENT_EXCEEDS_OUTSTANDING');
    expect(error.message).toContain('₹40.00');
    expect(fieldsOf(error)).toContain('amount');
    await json(await pay(api, gig.id, '40.00'), 201);
    const full = await failure(await pay(api, gig.id, '0.01'), 422, 'PAYMENT_EXCEEDS_OUTSTANDING');
    expect(full.message).toMatch(/already paid in full/);
  });

  test('eight payments of 30.00 sent at once against 100.00: exactly three are saved, five are refused, and 90.00 is received', async ({ request }) => {
    test.setTimeout(90_000);
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '100.00' });
    const responses = await Promise.all(Array.from({ length: 8 }, () => pay(api, gig.id, '30.00')));
    const statuses = responses.map((response) => response.status()).sort();
    expect(statuses).toEqual([201, 201, 201, 422, 422, 422, 422, 422]);
    const after = await json(await api.get(`/gigs/${gig.id}`), 200);
    expect(after).toMatchObject({ receivedAmount: '90.00', outstanding: '10.00', paymentStatus: 'partly_paid', paymentCount: 3 });
  });

  test('ten payments of 10.00 sent at once against 100.00 all succeed and end exactly paid', async ({ request }) => {
    test.setTimeout(90_000);
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '100.00' });
    const responses = await Promise.all(Array.from({ length: 10 }, () => pay(api, gig.id, '10.00')));
    expect(responses.map((response) => response.status())).toEqual(Array(10).fill(201));
    const after = await json(await api.get(`/gigs/${gig.id}`), 200);
    expect(after).toMatchObject({ receivedAmount: '100.00', outstanding: '0.00', paymentStatus: 'paid', paymentCount: 10 });
  });

  test('the agreed amount can drop to what was received but not below it', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '100.00' });
    await json(await pay(api, gig.id, '70.00'), 201);
    const body = { clientId: gig.clientId, title: gig.title, startDate: '2025-01-10', dueDate: '2025-02-10', workStatus: 'in_progress' };
    const error = await failure(await api.put(`/gigs/${gig.id}`, { ...body, agreedAmount: '69.99' }), 422, 'AGREED_BELOW_RECEIVED');
    expect(error.message).toContain('₹70.00');
    const lowered = await json(await api.put(`/gigs/${gig.id}`, { ...body, agreedAmount: '70.00' }), 200);
    expect(lowered).toMatchObject({ paymentStatus: 'paid', outstanding: '0.00' });
  });

  test('a payment dated tomorrow in the user\'s own time zone is refused, though it is already today elsewhere', async ({ request }) => {
    // Kiritimati is UTC+14 and Pago Pago is UTC-11, so their dates are always one or two days apart.
    const ahead = await newUser(request, { timeZone: 'Pacific/Kiritimati' });
    const behind = await newUser(request, { timeZone: 'Pacific/Pago_Pago' });
    const date = todayIn('Pacific/Kiritimati');
    expect(date > todayIn('Pacific/Pago_Pago')).toBe(true);

    const aheadGig = await newGig(ahead);
    await json(await pay(ahead, aheadGig.id, '10.00', date), 201);
    const behindGig = await newGig(behind);
    const error = await failure(await pay(behind, behindGig.id, '10.00', date), 400, 'VALIDATION_FAILED');
    expect(fieldsOf(error)).toContain('receivedOn');
  });
});

test.describe('gigs and their rules', () => {
  test('a due date before the start date is refused, and a missing client is a 400 naming clientId', async ({ request }) => {
    const api = await newUser(request);
    const client = await newClient(api);
    const early = await failure(await api.post('/gigs', { clientId: client.id, title: 'x', agreedAmount: '10.00', startDate: '2025-03-10', dueDate: '2025-03-09' }), 400, 'VALIDATION_FAILED');
    expect(fieldsOf(early)).toContain('dueDate');
    const missing = await failure(await api.post('/gigs', { clientId: '0123456789abcdef01234567', title: 'x', agreedAmount: '10.00', startDate: '2025-03-10', dueDate: '2025-03-11' }), 400, 'VALIDATION_FAILED');
    expect(fieldsOf(missing)).toContain('clientId');
  });

  test('moving a gig to another client moves its payments with it, so the dashboard follows', async ({ request }) => {
    const api = await newUser(request);
    const first = await newClient(api, 'First client');
    const second = await newClient(api, 'Second client');
    const gig = await newGig(api, { clientId: first.id, agreedAmount: '500.00' });
    await json(await pay(api, gig.id, '125.50', '2025-06-10'), 201);
    const share = async () => (await json(await api.get('/dashboard?period=custom&from=2025-01-01&to=2025-12-31'), 200)).topClients.map((c) => [c.name, c.paid]);
    expect(await share()).toEqual([['First client', '125.50']]);
    await json(await api.put(`/gigs/${gig.id}`, { clientId: second.id, title: gig.title, agreedAmount: '500.00', startDate: '2025-01-10', dueDate: '2025-02-10', workStatus: 'delivered' }), 200);
    expect(await share()).toEqual([['Second client', '125.50']]);
  });
});
