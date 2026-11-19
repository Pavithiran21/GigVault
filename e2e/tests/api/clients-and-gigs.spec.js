const { test, expect } = require('@playwright/test');
const { failure, fieldsOf, json, newClient, newGig, newUser, pay, PNG } = require('../../helpers/api');

// Clients and gigs: validation, the filters and pages of the list, what a delete does, and the ownership
// rule: every query is scoped to the logged-in user, and someone else's id answers 404.

test.describe('clients', () => {
  test('a blank name or a bad contact email is a 400 naming the field; blank optional fields are stored as not set', async ({ request }) => {
    const api = await newUser(request);
    expect(fieldsOf(await failure(await api.post('/clients', { name: '   ' }), 400, 'VALIDATION_FAILED'))).toContain('name');
    expect(fieldsOf(await failure(await api.post('/clients', { name: 'x'.repeat(121) }), 400, 'VALIDATION_FAILED'))).toContain('name');
    expect(fieldsOf(await failure(await api.post('/clients', { name: 'Okay', contactEmail: 'not-an-email' }), 400, 'VALIDATION_FAILED'))).toContain('contactEmail');
    const saved = await json(await api.post('/clients', { name: '  Kite Coffee  ', contactName: '   ', contactEmail: '', notes: '' }), 201);
    expect(saved).toMatchObject({ name: 'Kite Coffee', contactName: null, contactEmail: null, notes: null, gigCount: 0, paymentCount: 0, owed: '0.00' });
  });

  test('a client with gigs can\'t be deleted (409) until its gigs are gone; "owed" and the counts follow its gigs', async ({ request }) => {
    const api = await newUser(request);
    const client = await newClient(api);
    const gig = await newGig(api, { clientId: client.id, agreedAmount: '250.00' });
    await json(await pay(api, gig.id, '100.00'), 201);
    expect(await json(await api.get(`/clients/${client.id}`), 200)).toMatchObject({ gigCount: 1, paymentCount: 1, owed: '150.00' });
    const error = await failure(await api.delete(`/clients/${client.id}`), 409, 'CLIENT_IN_USE');
    expect(error.message).toMatch(/1 gig and 1 payment/);
    expect((await api.delete(`/gigs/${gig.id}`)).status()).toBe(204);
    expect((await api.delete(`/clients/${client.id}`)).status()).toBe(204);
    expect((await api.get(`/clients/${client.id}`)).status()).toBe(404);
  });
});

test.describe('the gigs list', () => {
  test('filters by client, work status, text and date range, and the CSV export uses the same filters', async ({ request }) => {
    const api = await newUser(request);
    const north = await newClient(api, 'Northwind');
    const lumen = await newClient(api, 'Lumen');
    const logo = await newGig(api, { clientId: north.id, title: 'Logo design', startDate: '2025-01-05', dueDate: '2025-01-20', workStatus: 'delivered' });
    await newGig(api, { clientId: north.id, title: 'Annual report', startDate: '2025-04-01', dueDate: '2025-04-30', workStatus: 'in_progress' });
    await newGig(api, { clientId: lumen.id, title: 'Logo refresh', startDate: '2025-02-01', dueDate: '2025-02-28', workStatus: 'pending' });
    const ids = async (query) => (await json(await api.get(`/gigs?${query}`), 200)).items.map((gig) => gig.title).sort();

    expect(await ids(`clientId=${north.id}`)).toEqual(['Annual report', 'Logo design']);
    expect(await ids('workStatus=delivered')).toEqual(['Logo design']);
    expect(await ids('q=logo')).toEqual(['Logo design', 'Logo refresh']);
    expect(await ids('q=.*')).toEqual([]); // the search text is not a pattern
    // A range keeps the gigs that overlap it.
    expect(await ids('from=2025-01-15&to=2025-02-10')).toEqual(['Logo design', 'Logo refresh']);
    expect(await ids('from=2025-03-01&to=2025-03-31')).toEqual([]);
    expect((await json(await api.get(`/gigs?q=logo&clientId=${north.id}`), 200)).items.map((gig) => gig.id)).toEqual([logo.id]);

    const csv = await api.get(`/exports/gigs.csv?clientId=${north.id}`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()['x-row-count']).toBe('2');
  });

  test('pages of a given size, sorting by a field, and a bad sort, size or status is a 400', async ({ request }) => {
    const api = await newUser(request);
    const client = await newClient(api);
    for (const [title, agreed] of [['Gig C', '30.00'], ['Gig A', '10.00'], ['Gig B', '20.00']]) await newGig(api, { clientId: client.id, title, agreedAmount: agreed });
    const page = await json(await api.get('/gigs?size=2&page=2&sort=agreedAmount'), 200);
    expect(page).toMatchObject({ page: 2, size: 2, totalItems: 3, totalPages: 2 });
    expect(page.items.map((gig) => gig.title)).toEqual(['Gig C']);
    const descending = await json(await api.get('/gigs?sort=-agreedAmount'), 200);
    expect(descending.items.map((gig) => gig.agreedAmount)).toEqual(['30.00', '20.00', '10.00']);
    await failure(await api.get('/gigs?sort=password'), 400);
    await failure(await api.get('/gigs?size=101'), 400, 'VALIDATION_FAILED');
    await failure(await api.get('/gigs?workStatus=done'), 400, 'VALIDATION_FAILED');
    await failure(await api.get('/gigs?from=2025-02-01&to=2025-01-01'), 400, 'VALIDATION_FAILED');
  });

  test('deleting a gig removes its payments and files with it, and the dashboard forgets them', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '100.00' });
    const payment = (await json(await pay(api, gig.id, '40.00', '2025-05-05'), 201)).payment;
    const file = await json(await api.upload(`/gigs/${gig.id}/attachments`, 'brief.png', PNG), 201);
    expect((await json(await api.get(`/gigs/${gig.id}`), 200)).attachmentCount).toBe(1);

    expect((await api.delete(`/gigs/${gig.id}`)).status()).toBe(204);
    expect((await api.get(`/gigs/${gig.id}`)).status()).toBe(404);
    expect((await api.delete(`/payments/${payment.id}`)).status()).toBe(404);
    expect((await api.get(file.downloadUrl.replace('/api', ''))).status()).toBe(404);
    expect((await json(await api.get('/payments'), 200)).totalItems).toBe(0);
    expect((await json(await api.get('/dashboard?period=custom&from=2025-01-01&to=2025-12-31'), 200)).earned).toBe('0.00');
  });
});

test.describe('ownership: someone else\'s id is "not found", never "forbidden"', () => {
  test('another user\'s client, gig, payment and file can\'t be read, changed or deleted, and don\'t appear in lists', async ({ request }) => {
    const owner = await newUser(request);
    const stranger = await newUser(request);
    const client = await newClient(owner, 'Private client');
    const gig = await newGig(owner, { clientId: client.id, title: 'Private gig' });
    const payment = (await json(await pay(owner, gig.id, '10.00'), 201)).payment;
    const file = await json(await owner.upload(`/gigs/${gig.id}/attachments`, 'secret.png', PNG), 201);
    const body = { clientId: client.id, title: 'Taken over', agreedAmount: '5.00', startDate: '2025-01-01', dueDate: '2025-01-02' };

    for (const response of [
      await stranger.get(`/clients/${client.id}`),
      await stranger.put(`/clients/${client.id}`, { name: 'Mine now' }),
      await stranger.delete(`/clients/${client.id}`),
      await stranger.get(`/gigs/${gig.id}`),
      await stranger.put(`/gigs/${gig.id}`, body),
      await stranger.delete(`/gigs/${gig.id}`),
      await stranger.get(`/gigs/${gig.id}/payments`),
      await pay(stranger, gig.id, '1.00'),
      await stranger.get(`/gigs/${gig.id}/attachments`),
      await stranger.upload(`/gigs/${gig.id}/attachments`, 'planted.png', PNG),
      await stranger.delete(`/payments/${payment.id}`),
      await stranger.get(`/attachments/${file.id}/download`),
      await stranger.delete(`/attachments/${file.id}`),
    ]) {
      expect(response.status(), response.url()).toBe(404);
    }
    // A new gig can't be attached to someone else's client either.
    expect(fieldsOf(await failure(await stranger.post('/gigs', body), 400, 'VALIDATION_FAILED'))).toContain('clientId');

    for (const path of ['/clients', '/gigs', '/payments']) expect((await json(await stranger.get(path), 200)).totalItems, path).toBe(0);
    // Nothing of the owner's changed.
    expect(await json(await owner.get(`/gigs/${gig.id}`), 200)).toMatchObject({ title: 'Private gig', receivedAmount: '10.00', attachmentCount: 1 });
  });
});
