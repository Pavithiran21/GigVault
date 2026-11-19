"""
The seeded accounts of the Playwright runs, on gigvault_test only (password E2E_PASSWORD from
.env.test). Most tests register their own fresh account through the API; these are the ones the
API can't make:
  locked@demo.gigvault.test   a demo account (isDemo), for the demo-lock tests: only a seed sets isDemo
  user@demo.gigvault.test     Kavya, the account behind "Log in as User" (DEMO_MODE=true, password DEMO_PASSWORD):
                              7 clients, 11 gigs, a year of payments; other@demo.gigvault.test is a second account

Usage (from backend/):
  $env:ENV_FILE='.env.test'; .venv\\Scripts\\python.exe -m scripts.seed_test
"""

import asyncio
import os

from app.core import database
from scripts.make_env import BACKEND_ROOT, read_env
from scripts.seed_demo import seed_demo_accounts
from scripts.seed_helpers import create_freelancer, remove_account

DEMO_ACCOUNTS = [("Lena Locked", "locked@demo.gigvault.test")]


async def main() -> None:
    env_file = os.environ.get("ENV_FILE", "")
    password = read_env(BACKEND_ROOT / env_file).get("E2E_PASSWORD", "") if env_file else ""
    if len(password) < 8:
        raise SystemExit("Set ENV_FILE=.env.test (written by scripts.make_env test, which holds E2E_PASSWORD).")

    await database.connect()
    try:
        name = database.get_db().name
        if name != "gigvault_test":
            raise SystemExit(f"seed_test only runs on gigvault_test, not on {name}.")
        await database.ensure_indexes()

        for account_name, email in DEMO_ACCOUNTS:
            await remove_account(email)
            await create_freelancer(account_name, email, password, is_demo=True, clients=[], gigs=[])
        await seed_demo_accounts()
        print(f"{name}: seeded the locked demo account and the two demo accounts")
    finally:
        await database.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
