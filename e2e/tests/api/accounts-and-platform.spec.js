const { randomBytes } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { SEEDED, apiUrl, failure, fieldsOf, json, login, loginAs, newGig, newUser } = require('../../helpers/api');
const { waitForMail } = require('../../helpers/mail');

// Accounts: sign-up rules, the refresh cookie, the password-reset link read from a real inbox, the profile,
// deleting an account, the locked demo accounts, and the edges of the API.

const newEmail = () => `user.${randomBytes(5).toString('hex')}@e2e.gigvault.test`;
const strongPassword = () => `Pw-${randomBytes(8).toString('hex')}-1`;
const register = (request, overrides = {}) =>
  request.post(apiUrl('/auth/register'), { data: { name: 'Asha Rao', email: newEmail(), password: strongPassword(), defaultCurrency: 'INR', timeZone: 'Asia/Kolkata', ...overrides } });

test.describe('registration and sessions', () => {
  test('creates the account, returns a token and sets an HttpOnly, SameSite=Strict refresh cookie scoped to /api/auth', async ({ request }) => {
    const response = await register(request);
    const body = await json(response, 201);
    expect(body.accessToken).toBeTruthy();
    expect(body.user).toMatchObject({ name: 'Asha Rao', defaultCurrency: 'INR', timeZone: 'Asia/Kolkata', isDemo: false });
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|password_hash/i);
    const cookie = response.headers()['set-cookie'];
    expect(cookie).toMatch(/gv_refresh=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
  });

  test('an email that is already taken is a 409 whatever its letter case; bad input is a 400 that names each field', async ({ request }) => {
    const email = newEmail();
    await json(await register(request, { email }), 201);
    expect(fieldsOf(await failure(await register(request, { email: email.toUpperCase() }), 409, 'EMAIL_TAKEN'))).toContain('email');
    for (const [overrides, field] of [
      [{ password: 'short' }, 'password'],
      [{ password: 'nodigitshere' }, 'password'],
      [{ email: 'not-an-email' }, 'email'],
      [{ name: '   ' }, 'name'],
      [{ timeZone: 'Mars/Olympus' }, 'timeZone'],
      [{ defaultCurrency: 'XXX' }, 'defaultCurrency'],
    ]) {
      expect(fieldsOf(await failure(await register(request, overrides), 400, 'VALIDATION_FAILED')), JSON.stringify(overrides)).toContain(field);
    }
  });

  test('log-in ignores the email\'s letter case, and a wrong password never says which half was wrong', async ({ request }) => {
    const email = newEmail();
    const password = strongPassword();
    await json(await register(request, { email, password }), 201);
    await json(await login(request, email.toUpperCase(), password), 200);
    const wrongPassword = await failure(await login(request, email, 'Wrong-pass-1'), 401, 'INVALID_CREDENTIALS');
    const unknownEmail = await failure(await login(request, newEmail(), 'Wrong-pass-1'), 401, 'INVALID_CREDENTIALS');
    expect(wrongPassword.message).toBe(unknownEmail.message);
  });

  test('a refresh token works once: refreshing issues a new pair, replaying the old one fails, and log-out ends the session', async ({ playwright, request }) => {
    const response = await register(request);
    await json(response, 201);
    const oldCookie = response.headers()['set-cookie'].split(';')[0];

    // Each call below is made with its own empty cookie jar, so only the cookie named here is sent.
    const withCookie = async (cookie, pathname) => {
      const context = await playwright.request.newContext();
      try {
        const reply = await context.post(apiUrl(pathname), { headers: { Cookie: cookie } });
        return { status: reply.status(), body: await reply.text(), cookie: reply.headers()['set-cookie']?.split(';')[0] };
      } finally {
        await context.dispose();
      }
    };
    const refreshed = await withCookie(oldCookie, '/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(JSON.parse(refreshed.body).accessToken).toBeTruthy();
    expect(refreshed.cookie).not.toBe(oldCookie);
    const replay = await withCookie(oldCookie, '/auth/refresh');
    expect(replay.status).toBe(401);
    expect(JSON.parse(replay.body).error.code).toBe('SESSION_EXPIRED');

    expect((await withCookie(refreshed.cookie, '/auth/logout')).status).toBe(204);
    expect((await withCookie(refreshed.cookie, '/auth/refresh')).status).toBe(401);
  });

  test('a missing or garbage token is a 401 on a protected route, and the error body has the standard shape', async ({ request }) => {
    const missing = await failure(await request.get(apiUrl('/me')), 401);
    expect(missing).toMatchObject({ code: expect.any(String), message: expect.any(String), details: expect.any(Array) });
    expect(missing.requestId).toBeTruthy();
    expect((await request.get(apiUrl('/me'), { headers: { Authorization: 'Bearer not.a.token' } })).status()).toBe(401);
  });
});

test.describe('password reset through the real inbox', () => {
  test.describe.configure({ timeout: 90_000 });

  const resetToken = async (email) => {
    // Mail to a .test address goes to the DEMO_SMTP_* inbox (app/core/mailer.py).
    const mail = await waitForMail({ to: email, subject: /Reset your GigVault password/, inbox: 'DEMO_SMTP' });
    const link = mail.html.match(/href="([^"]*\/reset-password\?token=([^"&]+))"/);
    expect(link, 'reset link in the email').toBeTruthy();
    return link[2];
  };

  test('the emailed link sets a new password once; the old password and the used link stop working, and it ends other sessions', async ({ request }) => {
    const user = await newUser(request);
    expect((await request.post(apiUrl('/auth/forgot-password'), { data: { email: user.email } })).status()).toBe(202);
    const token = await resetToken(user.email);

    const newPassword = 'Fresh-password-42';
    expect((await request.post(apiUrl('/auth/reset-password'), { data: { token, password: newPassword } })).status()).toBe(204);
    await failure(await login(request, user.email, user.password), 401, 'INVALID_CREDENTIALS');
    await json(await login(request, user.email, newPassword), 200);
    await failure(await request.post(apiUrl('/auth/reset-password'), { data: { token, password: 'Another-pass-1' } }), 400, 'RESET_LINK_EXPIRED');
  });

  test('only the newest link works, a made-up token is refused, and an unknown email gets the same 202', async ({ request }) => {
    const user = await newUser(request);
    await request.post(apiUrl('/auth/forgot-password'), { data: { email: user.email } });
    const first = await resetToken(user.email);
    await request.post(apiUrl('/auth/forgot-password'), { data: { email: user.email } });
    // The second mail arrives after the first: wait until the newest link is a different one.
    let second = first;
    for (let attempt = 0; attempt < 15 && second === first; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      second = await resetToken(user.email);
    }
    expect(second).not.toBe(first);

    await failure(await request.post(apiUrl('/auth/reset-password'), { data: { token: first, password: 'Old-link-pass-1' } }), 400, 'RESET_LINK_EXPIRED');
    const fake = randomBytes(32).toString('base64url');
    await failure(await request.post(apiUrl('/auth/reset-password'), { data: { token: fake, password: 'Made-up-pass-1' } }), 400, 'RESET_LINK_EXPIRED');
    expect(fieldsOf(await failure(await request.post(apiUrl('/auth/reset-password'), { data: { token: 'short', password: 'Made-up-pass-1' } }), 400, 'VALIDATION_FAILED'))).toContain('token');
    expect((await request.post(apiUrl('/auth/reset-password'), { data: { token: second, password: 'Newest-link-pass-1' } })).status()).toBe(204);

    const unknown = await request.post(apiUrl('/auth/forgot-password'), { data: { email: newEmail() } });
    expect(unknown.status()).toBe(202);
  });
});

test.describe('profile', () => {
  test('changes the name, currency and time zone (nothing is converted); an empty change is refused and a sent email is ignored', async ({ request }) => {
    const api = await newUser(request);
    const gig = await newGig(api, { agreedAmount: '100.00' });
    const changed = await json(await api.patch('/me', { name: 'Meera Nair', defaultCurrency: 'USD', timeZone: 'Europe/London', email: 'someone.else@e2e.gigvault.test' }), 200);
    expect(changed).toMatchObject({ name: 'Meera Nair', defaultCurrency: 'USD', timeZone: 'Europe/London', email: api.email });
    expect((await json(await api.get(`/gigs/${gig.id}`), 200)).agreedAmount).toBe('100.00');
    await failure(await api.patch('/me', {}), 400, 'VALIDATION_FAILED');
    await failure(await api.patch('/me', { timeZone: 'Nowhere/Land' }), 400, 'VALIDATION_FAILED');
  });

  test('changing the password needs the current one, returns a new token, and signs out the other sessions', async ({ playwright, request }) => {
    const user = await newUser(request);
    const otherDevice = await playwright.request.newContext();
    try {
      const body = await json(await otherDevice.post(apiUrl('/auth/login'), { data: { email: user.email, password: user.password } }), 200);
      expect(body.accessToken).toBeTruthy();
      const wrong = await failure(await user.post('/me/password', { currentPassword: 'Not-my-pass-1', newPassword: 'Brand-new-pass-1' }), 400, 'WRONG_PASSWORD');
      expect(fieldsOf(wrong)).toContain('currentPassword');
      const changed = await json(await user.post('/me/password', { currentPassword: user.password, newPassword: 'Brand-new-pass-1' }), 200);
      expect(changed.accessToken).toBeTruthy();
      // The other device's refresh cookie was deleted with the rest.
      expect((await otherDevice.post(apiUrl('/auth/refresh'))).status()).toBe(401);
    } finally {
      await otherDevice.dispose();
    }
    await json(await login(request, user.email, 'Brand-new-pass-1'), 200);
    await failure(await login(request, user.email, user.password), 401, 'INVALID_CREDENTIALS');
  });

  test('deleting the account needs the password, removes everything, and frees the email', async ({ request }) => {
    const user = await newUser(request);
    await newGig(user);
    const wrong = await failure(await user.delete('/me', { password: 'Wrong-pass-1' }), 400, 'WRONG_PASSWORD');
    expect(fieldsOf(wrong)).toContain('password');
    expect((await user.delete('/me', { password: user.password })).status()).toBe(204);
    await failure(await login(request, user.email, user.password), 401, 'INVALID_CREDENTIALS');
    // The old token still verifies for a few minutes, but the account behind it is gone.
    await failure(await user.get('/me'), 401, 'UNAUTHENTICATED');
    expect((await json(await user.get('/gigs'), 200)).totalItems).toBe(0);
    await json(await register(request, { email: user.email }), 201);
  });
});

test.describe('the demo accounts', () => {
  test('a demo account can\'t change its password or delete itself', async ({ request }) => {
    const locked = await loginAs(request, SEEDED.locked);
    await failure(await locked.post('/me/password', { currentPassword: process.env.E2E_PASSWORD, newPassword: 'Changed-pass-1' }), 403, 'DEMO_ACCOUNT_LOCKED');
    await failure(await locked.delete('/me', { password: process.env.E2E_PASSWORD }), 403, 'DEMO_ACCOUNT_LOCKED');
    expect((await json(await locked.get('/me'), 200)).isDemo).toBe(true);
  });

  test('with DEMO_MODE on, /api/demo lists both demo accounts but never a password, and Kavya\'s year of data is there', async ({ request }) => {
    const info = await json(await request.get(apiUrl('/demo')), 200);
    expect(info).toEqual({ accounts: [{ role: 'User', email: SEEDED.demo }, { role: 'Second user', email: SEEDED.otherDemo }] });
    expect(JSON.stringify(info)).not.toContain(process.env.DEMO_PASSWORD);
    const kavya = await loginAs(request, SEEDED.demo, process.env.DEMO_PASSWORD);
    expect(await json(await kavya.get('/me'), 200)).toMatchObject({ name: 'Kavya Nair', isDemo: true });
    const clients = await json(await kavya.get('/clients'), 200);
    expect(clients.totalItems).toBe(7);
    expect((await json(await kavya.get('/gigs?size=100'), 200)).totalItems).toBe(11);
    // 18,000.00 + 12,500.00 + 42,750.00, as in the design.
    expect((await json(await kavya.get('/dashboard?period=year'), 200)).outstanding.amount).toBe('73250.00');
  });

  test('"Log in as" starts a demo session without a password; only the two demo roles are accepted', async ({ request }) => {
    for (const [role, email] of [['User', SEEDED.demo], ['Second user', SEEDED.otherDemo]]) {
      const response = await request.post(apiUrl('/demo/login'), { data: { role } });
      const session = await json(response, 200);
      expect(session.user).toMatchObject({ email, isDemo: true });
      expect(response.headers()['set-cookie']).toMatch(/gv_refresh=.*HttpOnly/i);
      expect((await request.get(apiUrl('/me'), { headers: { Authorization: `Bearer ${session.accessToken}` } })).status()).toBe(200);
    }
    await failure(await request.post(apiUrl('/demo/login'), { data: { role: 'Admin' } }), 400, 'VALIDATION_FAILED');
  });

  test('the second demo account\'s gig is "not found" for the first', async ({ request }) => {
    const kavya = await loginAs(request, SEEDED.demo, process.env.DEMO_PASSWORD);
    const arjun = await loginAs(request, SEEDED.otherDemo, process.env.DEMO_PASSWORD);
    const theirs = (await json(await arjun.get('/gigs'), 200)).items[0];
    expect(theirs.title).toBe('Landing page');
    expect((await kavya.get(`/gigs/${theirs.id}`)).status()).toBe(404);
  });
});

test.describe('the edges of the API', () => {
  test('/api/health reports ok, and an unknown route is a JSON 404 with a request id', async ({ request }) => {
    expect(await json(await request.get(apiUrl('/health')), 200)).toMatchObject({ status: 'ok' });
    const error = await failure(await request.get(apiUrl('/no-such-route')), 404, 'ROUTE_NOT_FOUND');
    expect(error.requestId).toBeTruthy();
  });

  test('a malformed JSON body is a 400, an oversized one is a 413, and the request id of the caller is echoed', async ({ request }) => {
    await failure(await request.post(apiUrl('/auth/login'), { data: Buffer.from('{"email":'), headers: { 'Content-Type': 'application/json' } }), 400, 'INVALID_JSON');
    await failure(await request.post(apiUrl('/clients'), { data: { name: 'x'.repeat(20_000) }, headers: { Authorization: `Bearer ${(await newUser(request)).token}` } }), 413, 'PAYLOAD_TOO_LARGE');
    const echoed = await request.get(apiUrl('/health'), { headers: { 'X-Request-Id': 'trace-me-123' } });
    expect(echoed.headers()['x-request-id']).toBe('trace-me-123');
  });

  test('security headers are on, and the API docs are only outside production', async ({ request }) => {
    const headers = (await request.get(apiUrl('/health'))).headers();
    expect(headers).toMatchObject({ 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' });
    expect((await request.get(apiUrl('/docs'))).status()).toBe(200);
  });
});
