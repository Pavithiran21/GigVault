const { test, expect } = require('@playwright/test');
const { PNG, json, newClient, newGig, newUser, pay, todayIn } = require('../../helpers/api');
const { logIn } = require('../../helpers/ui');

// One browser flow through the money: a client, a gig, partial payments with the balance following, the
// refusal of an overpayment, a file attached to the gig, and the dashboard that adds it all up.

test('add a client and a gig, record two payments: the balance, status and toast follow', async ({ page, request }) => {
  const user = await newUser(request);
  await logIn(page, user.email, user.password);

  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add client' }).first().click();
  await page.getByLabel('Name', { exact: true }).fill('Kite Coffee');
  await page.getByRole('dialog').getByRole('button', { name: 'Save client' }).click();
  await expect(page.getByText('Client added')).toBeVisible();

  await page.goto('/gigs/new');
  await page.getByLabel('Client').selectOption({ label: 'Kite Coffee' });
  await page.getByLabel('Title').fill('Menu illustrations');
  await page.getByLabel('Agreed amount').fill('24850.00');
  await page.getByLabel('Start').fill('2026-01-05');
  await page.getByLabel('Due').fill('2026-02-05');
  await page.getByRole('button', { name: 'Create gig' }).click();
  await expect(page.getByRole('heading', { name: 'Menu illustrations' })).toBeVisible();
  await expect(page.getByText('₹24,850.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'Record payment' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount').fill('10000');
  await dialog.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Payment saved · ₹14,850.00 left')).toBeVisible();
  await expect(page.getByText('Part paid').first()).toBeVisible();

  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Use full amount' }).click();
  await expect(page.getByRole('dialog').getByLabel('Amount')).toHaveValue('14850.00');
  await page.getByRole('dialog').getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Payment saved · paid in full')).toBeVisible();
  await expect(page.getByText('Paid in full. Nothing left to record.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record payment' })).toBeDisabled();
});

test('a payment over what is still owed is refused under the amount field and nothing is saved', async ({ page, request }) => {
  const user = await newUser(request);
  const gig = await newGig(user, { title: 'Poster', agreedAmount: '1000.00' });
  await json(await pay(user, gig.id, '600.00'), 201);
  await logIn(page, user.email, user.password);
  await page.goto(`/gigs/${gig.id}`);

  await page.getByRole('button', { name: 'Record payment' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount').fill('400.01');
  await dialog.getByRole('button', { name: 'Save payment' }).click();
  await expect(dialog.getByText(/more than the ₹400\.00 still owed/)).toBeVisible();
  expect((await json(await user.get(`/gigs/${gig.id}`), 200)).receivedAmount).toBe('600.00');

  await dialog.getByLabel('Amount').fill('400.00');
  await dialog.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Payment saved · paid in full')).toBeVisible();
});

test('delete a payment and the balance comes back; delete the gig and it is gone', async ({ page, request }) => {
  const user = await newUser(request);
  const gig = await newGig(user, { title: 'Brand refresh', agreedAmount: '500.00' });
  await json(await pay(user, gig.id, '200.00', '2025-06-10'), 201);
  await logIn(page, user.email, user.password);
  await page.goto(`/gigs/${gig.id}`);

  await page.getByRole('button', { name: /^Delete payment of ₹200\.00/ }).click();
  await page.getByRole('button', { name: 'Delete payment', exact: true }).click();
  await expect(page.getByText('No payments yet.')).toBeVisible();
  expect((await json(await user.get(`/gigs/${gig.id}`), 200)).outstanding).toBe('500.00');

  await page.getByRole('button', { name: 'Delete gig' }).click();
  await page.getByRole('button', { name: 'Delete gig', exact: true }).last().click();
  await expect.poll(async () => (await user.get(`/gigs/${gig.id}`)).status()).toBe(404);
});

test('attach a file to a gig, download it, and delete it', async ({ page, request }) => {
  const user = await newUser(request);
  const gig = await newGig(user, { title: 'Contract work' });
  await logIn(page, user.email, user.password);
  await page.goto(`/gigs/${gig.id}`);

  await page.locator('input[type="file"]').setInputFiles({ name: 'signed-contract.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('button', { name: 'signed-contract.png', exact: true })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'signed-contract.png', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('signed-contract.png');

  await page.getByRole('button', { name: 'Delete signed-contract.png' }).click();
  await page.getByRole('button', { name: 'Delete file', exact: true }).click();
  await expect(page.getByText('File deleted')).toBeVisible();
  await expect(page.getByRole('button', { name: 'signed-contract.png', exact: true })).toHaveCount(0);
});

test('the earnings page adds up what was received today, and what is still owed', async ({ page, request }) => {
  const user = await newUser(request);
  const client = await newClient(user, 'Orbit Fintech');
  const gig = await newGig(user, { clientId: client.id, title: 'Mobile app UI', agreedAmount: '82750.00' });
  await json(await pay(user, gig.id, '1234.50', todayIn('Asia/Kolkata')), 201);
  await logIn(page, user.email, user.password);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible();
  await expect(page.getByText('₹1,234.50').first()).toBeVisible();
  await expect(page.getByText('₹81,515.50').first()).toBeVisible();
  await expect(page.getByText('Orbit Fintech').first()).toBeVisible();
});

test('the gigs list exports the filtered gigs as a CSV file', async ({ page, request }) => {
  const user = await newUser(request);
  await newGig(user, { title: 'Logo design' });
  await newGig(user, { title: 'Annual report' });
  await logIn(page, user.email, user.password);
  await page.goto('/gigs');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export these gigs as CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await expect(page.getByText(/CSV ready: 2 gigs/)).toBeVisible();
});

test('another user\'s gig id shows "Gig not found", not their data', async ({ page, request }) => {
  const owner = await newUser(request);
  const gig = await newGig(owner, { title: 'Private gig' });
  const stranger = await newUser(request);
  await logIn(page, stranger.email, stranger.password);
  await page.goto(`/gigs/${gig.id}`);
  await expect(page.getByText('Gig not found')).toBeVisible();
  await expect(page.getByText('Private gig')).toHaveCount(0);
});
