const { expect } = require('@playwright/test');

/** Logs in on /login (email first, then the password) and waits until the app has left the log-in pages. */
async function logIn(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
}

/** The toast region's text (the app shows "Payment saved · ₹40.00 left" and similar). */
const toast = (page, text) => page.getByText(text).first();

module.exports = { logIn, toast };
