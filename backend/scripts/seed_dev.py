"""
Development data on the gigvault database only:
  dev@gigvault.test  a normal (non-demo) account with the same freelancer year as the demo
  and the two demo accounts (see seed_demo.py)
Every account uses DEMO_PASSWORD. Existing copies of these accounts are replaced; nothing else is touched.

Usage (from backend/): .venv\\Scripts\\python.exe -m scripts.seed_dev
"""

import asyncio

from app.core import database
from app.core.config import get_settings
from scripts.seed_demo import seed_demo_accounts
from scripts.seed_helpers import create_freelancer, remove_account

DEV_USER = ("Dev Freelancer", "dev@gigvault.test")


async def main() -> None:
    await database.connect()
    try:
        name = database.get_db().name
        if name != "gigvault":
            raise SystemExit(f"seed_dev only runs on the gigvault database, not on {name}.")
        await database.ensure_indexes()

        await remove_account(DEV_USER[1])
        summaries = [await create_freelancer(*DEV_USER, get_settings().demo_password, is_demo=False)]
        summaries += await seed_demo_accounts()
        for summary in summaries:
            print(f"{name}: {summary['email']} with {summary['clients']} clients, {summary['gigs']} gigs, {summary['payments']} payments")
    finally:
        await database.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
