const { test, expect } = require('@playwright/test');
const { DOCX, JPEG, PDF, PNG, ZIP_NOT_WORD, failure, json, newGig, newUser } = require('../../helpers/api');

// Files are kept inside MongoDB with their gig. The real type comes from the file's first bytes, never from
// its name or the type the sender claims, and a file is downloaded only through its owner's own endpoint.

test.describe('attachments', () => {
  test('the real type is read from the first bytes: PDF, DOCX, PNG and JPEG are kept whatever they are called', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api);
    const cases = [
      ['contract.txt', PDF, 'application/pdf'],
      ['scan.pdf', PNG, 'image/png'],
      ['photo.png', JPEG, 'image/jpeg'],
      ['brief.bin', DOCX, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ];
    for (const [name, buffer, type] of cases) {
      const saved = await json(await api.upload(`/gigs/${gig.id}/attachments`, name, buffer, 'text/plain'), 201);
      expect(saved).toMatchObject({ fileName: name, contentType: type, size: buffer.length, gigId: gig.id });
    }
    expect((await json(await api.get(`/gigs/${gig.id}/attachments`), 200)).totalItems).toBe(4);
    expect((await json(await api.get(`/gigs/${gig.id}`), 200)).attachmentCount).toBe(4);
  });

  test('a text file called .pdf, a ZIP that is not a Word file, an executable and an empty file are all refused', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api);
    const upload = (name, buffer, type = 'application/pdf') => api.upload(`/gigs/${gig.id}/attachments`, name, buffer, type);
    await failure(await upload('invoice.pdf', Buffer.from('this is only text')), 415, 'FILE_TYPE_NOT_ALLOWED');
    await failure(await upload('notes.docx', ZIP_NOT_WORD), 415, 'FILE_TYPE_NOT_ALLOWED');
    await failure(await upload('tool.exe', Buffer.from('MZ\x90\x00\x03\x00\x00\x00')), 415, 'FILE_TYPE_NOT_ALLOWED');
    await failure(await upload('empty.pdf', Buffer.alloc(0)), 400, 'EMPTY_FILE');
    expect((await json(await api.get(`/gigs/${gig.id}/attachments`), 200)).totalItems).toBe(0);
  });

  test('a file over 10 MB is a 413, and exactly 10 MB is kept', async ({ request }) => {
    test.setTimeout(90_000);
    const api = await newUser(request);
    const gig = await newGig(api);
    const header = Buffer.from('%PDF-1.4\n');
    const sized = (bytes) => Buffer.concat([header, Buffer.alloc(bytes - header.length, 0x20)]);
    await failure(await api.upload(`/gigs/${gig.id}/attachments`, 'big.pdf', sized(10 * 1024 * 1024 + 1)), 413, 'FILE_TOO_LARGE');
    await failure(await api.upload(`/gigs/${gig.id}/attachments`, 'huge.pdf', sized(11 * 1024 * 1024)), 413, 'FILE_TOO_LARGE');
    const kept = await json(await api.upload(`/gigs/${gig.id}/attachments`, 'limit.pdf', sized(10 * 1024 * 1024)), 201);
    expect(kept.size).toBe(10 * 1024 * 1024);
  });

  test('download sends the same bytes with the real type, nosniff and no caching; a path in the name is cut to its last part', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api);
    const saved = await json(await api.upload(`/gigs/${gig.id}/attachments`, 'C:\\fakepath\\..\\contract.pdf', PDF), 201);
    expect(saved.fileName).toBe('contract.pdf');
    const response = await api.get(saved.downloadUrl.replace('/api', ''));
    expect(response.status()).toBe(200);
    expect(Buffer.from(await response.body()).equals(PDF)).toBe(true);
    expect(response.headers()).toMatchObject({ 'content-type': 'application/pdf', 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' });
    expect(response.headers()['content-disposition']).toContain('contract.pdf');

    expect((await api.delete(`/attachments/${saved.id}`)).status()).toBe(204);
    expect((await api.get(`/attachments/${saved.id}/download`)).status()).toBe(404);
  });

  test('a download needs a log-in', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api);
    const saved = await json(await api.upload(`/gigs/${gig.id}/attachments`, 'a.png', PNG), 201);
    await failure(await request.get(`${process.env.E2E_API_URL}/attachments/${saved.id}/download`), 401);
  });
});

test.describe('CSV export', () => {
  test('one row per gig with exact amounts, and the file name, row count and no-store headers', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { title: 'Logo, "final" version', agreedAmount: '1234.50', startDate: '2025-02-03', dueDate: '2025-03-04' });
    await json(await api.post(`/gigs/${gig.id}/payments`, { amount: '234.50', receivedOn: '2025-02-10', method: 'upi' }), 201);
    const response = await api.get('/exports/gigs.csv');
    expect(response.status()).toBe(200);
    expect(response.headers()).toMatchObject({ 'x-row-count': '1', 'cache-control': 'private, no-store' });
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(response.headers()['content-disposition']).toMatch(/^attachment; filename="[^"]+\.csv"$/);
    const [header, row] = (await response.text()).trim().split(/\r?\n/);
    expect(header).toBe('Title,Client,Work status,Payment status,Currency,Agreed,Received,Outstanding,Start date,Due date');
    expect(row).toMatch(/^"Logo, ""final"" version",.*,In progress,Part paid,INR,1234.50,234.50,1000.00,2025-02-03,2025-03-04$/);
  });

  test('a title that starts with = + - or @ is saved as text, so a spreadsheet never runs it as a formula', async ({ request }) => {
    const api = await newUser(request);
    for (const title of ['=HYPERLINK("http://evil.test","x")', '+1+1', '-2+3', '@SUM(A1)']) await newGig(api, { title });
    const lines = (await (await api.get('/exports/gigs.csv')).text()).trim().split(/\r?\n/).slice(1);
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(line).toMatch(/^"?'[=+\-@]/);
  });

  test('an empty list is a header-only file with a row count of 0', async ({ request }) => {
    const api = await newUser(request);
    const response = await api.get('/exports/gigs.csv');
    expect(response.headers()['x-row-count']).toBe('0');
    expect((await response.text()).trim().split(/\r?\n/)).toHaveLength(1);
  });
});
