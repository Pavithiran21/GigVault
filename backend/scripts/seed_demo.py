"""
Creates the demo accounts (password DEMO_PASSWORD, public on purpose):
  user@demo.gigvault.test   Kavya Nair, a freelancer's year: 7 clients, 11 gigs, partial payments
  other@demo.gigvault.test  a second normal account, only to show that another user's gig is "not found"

On gigvault_demo (the from-scratch demo database) it empties every collection first.
On gigvault (development) it replaces only the demo accounts.
Any other database is refused, so it can never touch the test data.

Usage (from backend/):
  set ENV_FILE=.env.demo   (PowerShell: $env:ENV_FILE='.env.demo')
  .venv\\Scripts\\python.exe -m scripts.seed_demo
"""

import asyncio

from app.core import database
from app.core.config import get_settings
from scripts.seed_helpers import OTHER_CLIENTS, OTHER_GIGS, create_freelancer, remove_account

DEMO_USER = ("Kavya Nair", "user@demo.gigvault.test")
OTHER_USER = ("Arjun Mehta", "other@demo.gigvault.test")
ALLOWED_DATABASES = ("gigvault_demo", "gigvault")


async def seed_demo_accounts() -> list[dict]:
    password = get_settings().demo_password
    if len(password) < 8:
        raise SystemExit("DEMO_PASSWORD in backend/.env must be at least 8 characters.")

    for _, email in (DEMO_USER, OTHER_USER):
        await remove_account(email)
    return [
        await create_freelancer(*DEMO_USER, password, is_demo=True),
        await create_freelancer(*OTHER_USER, password, is_demo=True, clients=OTHER_CLIENTS, gigs=OTHER_GIGS),
    ]


async def main() -> None:
    await database.connect()
    try:
        name = database.get_db().name
        if name not in ALLOWED_DATABASES:
            raise SystemExit(f"seed_demo only runs on {' or '.join(ALLOWED_DATABASES)}, not on {name}.")

        if name == "gigvault_demo":
            for collection in await database.get_db().list_collection_names():
                await database.get_db()[collection].delete_many({})
        await database.ensure_indexes()

        for summary in await seed_demo_accounts():
            print(f"{name}: {summary['email']} with {summary['clients']} clients, {summary['gigs']} gigs, {summary['payments']} payments")
    finally:
        await database.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
