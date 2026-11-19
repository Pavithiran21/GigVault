const { randomBytes } = require('node:crypto');
const { crc32 } = require('node:zlib');
const { expect } = require('@playwright/test');

// A small API client over Playwright's request context, plus tiny real files (PNG, PDF, DOCX) built in
// memory for the attachment tests. Every test registers its own user, so its data is its own.

const SEEDED = { locked: 'locked@demo.gigvault.test', demo: 'user@demo.gigvault.test', otherDemo: 'other@demo.gigvault.test' };

const apiUrl = (pathname) => `${process.env.E2E_API_URL}${pathname}`;

function client(request, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const call = (method) => (pathname, data) => request.fetch(apiUrl(pathname), { method, headers, ...(data === undefined ? {} : { data }) });
  const upload = (pathname, fileName, buffer, mimeType = 'application/octet-stream') =>
    request.fetch(apiUrl(pathname), { method: 'POST', headers, multipart: { file: { name: fileName, mimeType, buffer } } });
  return { get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH'), delete: call('DELETE'), upload, token };
}

/** The JSON body of a response that must have the given status. */
async function json(response, status) {
  const text = await response.text();
  expect(response.status(), text.slice(0, 500)).toBe(status);
  return text ? JSON.parse(text) : null;
}

/** The error body of a response that must have the given status: { code, message, details, requestId }. */
async function failure(response, status, code) {
  const body = await json(response, status);
  expect(body.error, JSON.stringify(body)).toBeTruthy();
  if (code) expect(body.error.code).toBe(code);
  return body.error;
}

const fieldsOf = (error) => error.details.map((detail) => detail.field);

async function newUser(request, { timeZone = 'Asia/Kolkata', defaultCurrency = 'INR' } = {}) {
  const email = `user.${randomBytes(5).toString('hex')}@e2e.gigvault.test`;
  const password = `Pw-${randomBytes(8).toString('hex')}-1`;
  const body = await json(await request.post(apiUrl('/auth/register'), { data: { name: 'Test User', email, password, defaultCurrency, timeZone } }), 201);
  return { ...client(request, body.accessToken), email, password, id: body.user.id };
}

async function loginAs(request, email, password = process.env.E2E_PASSWORD) {
  const body = await json(await request.post(apiUrl('/auth/login'), { data: { email, password } }), 200);
  return client(request, body.accessToken);
}

const login = (request, email, password) => request.post(apiUrl('/auth/login'), { data: { email, password } });

async function newClient(api, name = `Client ${randomBytes(3).toString('hex')}`) {
  return json(await api.post('/clients', { name }), 201);
}

/** A gig for a client (a new one when none is given). Dates are fixed in the past, so they never depend on today. */
async function newGig(api, { clientId, title = 'Logo design', agreedAmount = '100.00', startDate = '2025-01-10', dueDate = '2025-02-10', workStatus = 'in_progress' } = {}) {
  const owner = clientId ?? (await newClient(api)).id;
  return json(await api.post('/gigs', { clientId: owner, title, agreedAmount, startDate, dueDate, workStatus }), 201);
}

const pay = (api, gigId, amount, receivedOn = '2025-01-20', method = 'upi') => api.post(`/gigs/${gigId}/payments`, { amount, receivedOn, method });

/** Today's date (YYYY-MM-DD) in a time zone, the way the backend works it out. */
const todayIn = (timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// ---- tiny real files -------------------------------------------------------------------------

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'), Buffer.from([0xff, 0xd9])]);

/** A ZIP of stored (uncompressed) entries: { 'name': 'content' }. A DOCX is one with Word's two key parts. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const DOCX = zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<w:document/>' });
const ZIP_NOT_WORD = zip({ 'readme.txt': 'just a zip' });

module.exports = {
  SEEDED, apiUrl, client, json, failure, fieldsOf, newUser, loginAs, login, newClient, newGig, pay, todayIn,
  PNG, PDF, JPEG, DOCX, ZIP_NOT_WORD,
};
