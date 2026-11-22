const { randomBytes } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { SEEDED, loginAs, newUser, json } = require('../../helpers/api');
const { waitForMail } = require('../../helpers/mail');
const { logIn } = require('../../helpers/ui');

// The browser side of accounts: the two-step log-in, the signed-out redirect that remembers the page,
// sign-up, log-out, the demo panel, and the password reset with the real email.

test('a signed-out visitor is sent to Log in, and after logging in lands on the page they asked for', async ({ page, request }) => {
  const user = await newUser(request);
  await page.goto('/gigs');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/gigs$/);
});

test('a wrong password shows one message under the password field and keeps the visitor on the log-in page', async ({ page, request }) => {
  const user = await newUser(request);
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password', { exact: true }).fill('Not-the-password-1');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByText("That email or password doesn't match")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('create an account in the browser: an empty start, then log out and back in', async ({ page }) => {
  const email = `ui.${randomBytes(5).toString('hex')}@e2e.gigvault.test`;
  const password = `Pw-${randomBytes(6).toString('hex')}-1`;
  await page.goto('/register');
  await page.getByLabel('Name').fill('Meera Nair');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'No gigs yet' })).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: /Log out/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/gigs');
  await expect(page).toHaveURL(/\/login$/);

  // Sent to Log in from /gigs, the visitor is taken back there afterwards.
  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/gigs$/);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No gigs yet' })).toBeVisible();
});

test('the demo panel shows the demo account but no password, and logs in with one click to a year of data', async ({ page, request }) => {
  await page.goto('/login');
  const demo = page.getByRole('region', { name: /Demo mode/ });
  await expect(demo).toContainText(SEEDED.demo);
  await expect(demo).not.toContainText(process.env.DEMO_PASSWORD);
  await expect(demo).not.toContainText(/password/i);
  await demo.getByRole('button', { name: /Log in as User/ }).click();
  await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible();

  // What the screen shows is what the API says: this year's total, to the cent.
  const kavya = await loginAs(request, SEEDED.demo, process.env.DEMO_PASSWORD);
  const { outstanding } = await json(await kavya.get('/dashboard?period=year'), 200);
  expect(outstanding.amount).toBe('73250.00');
  await expect(page.getByText('₹73,250.00').first()).toBeVisible();
});

test('the demo panel also offers a second user, who sees only their own gig', async ({ page }) => {
  await page.goto('/login');
  const demo = page.getByRole('region', { name: /Demo mode/ });
  await expect(demo).toContainText(SEEDED.otherDemo);
  await demo.getByRole('button', { name: /Log in as Second user/ }).click();
  await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible();

  await page.goto('/gigs');
  await expect(page.getByText('Landing page').first()).toBeVisible();
  // Kavya's gigs belong to the first demo user and are not in this list.
  await expect(page.getByText('Brand refresh')).toHaveCount(0);
  await expect(page.getByText('Website copy')).toHaveCount(0);
});

test('forgot password: the emailed link sets a new password that then logs in', async ({ page, request }) => {
  test.setTimeout(90_000);
  const user = await newUser(request);
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeEnabled();

  // Mail to a .test address goes to the DEMO_SMTP_* inbox (app/core/mailer.py).
  const mail = await waitForMail({ to: user.email, subject: /Reset your GigVault password/, inbox: 'DEMO_SMTP' });
  const link = mail.html.match(/href="([^"]*\/reset-password\?token=[^"]+)"/)?.[1];
  expect(link, 'reset link in the email').toBeTruthy();
  // The link points at FRONTEND_URL; open the same path on this run's frontend.
  const { pathname, search } = new URL(link.replace(/&amp;/g, '&'));
  await page.goto(pathname + search);

  const newPassword = 'Fresh-password-42';
  await page.getByLabel('New password').fill(newPassword);
  await page.getByLabel('Confirm password').fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await logIn(page, user.email, newPassword);
});
