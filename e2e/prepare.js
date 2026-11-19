/**
 * Gets gigvault_test ready for a Playwright run, using the backend's own scripts:
 *   1. scripts.make_env test  -> backend/.env.test (gigvault_test on the same MongoDB, a new JWT secret,
 *                                new Ethereal inboxes, a new E2E_PASSWORD that is also DEMO_PASSWORD,
 *                                DEMO_MODE on, rate limits off), layered over backend/.env
 *   2. scripts.seed_test      -> the accounts the API can't make: a locked demo account, three
 *                                rate-limit accounts, and the two demo accounts with a year of data
 *
 * Python: $PYTHON, else backend/.venv's, else "python".
 * Usage: npm test (runs this, then playwright test), or node prepare.js on its own.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const backend = path.resolve(__dirname, '../backend');
const venvPython = path.join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.PYTHON ?? (fs.existsSync(venvPython) ? venvPython : 'python');

function run(args, env = {}) {
  execFileSync(python, args, { cwd: backend, env: { ...process.env, ...env }, stdio: 'inherit' });
}

run(['-m', 'scripts.make_env', 'test', ...process.argv.slice(2)]);
run(['-m', 'scripts.seed_test'], { ENV_FILE: '.env.test' });
console.log('Ready: run "npx playwright test".');
