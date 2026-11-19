"""
Shared by seed_dev and seed_demo: one realistic freelancer year, written through the same
repository functions the API uses (so paidTotal is built exactly like real payments).
Dates are relative to today, so the dashboard always has a current month and year.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from app.core.dates import first_of_month, to_datetime, today_in
from app.core.security import hash_password
from app.repositories import (
    attachment_repository,
    client_repository,
    gig_repository,
    payment_repository,
    token_repository,
    user_repository,
)

TIME_ZONE = "Asia/Kolkata"

# name, contact name, contact email
CLIENTS = [
    ("Northwind Studio", "Anita Rao", "anita@northwind.test"),
    ("Lumen Books", "Dev Malhotra", "dev@lumenbooks.test"),
    ("Kite Coffee", "Rahul Iyer", "rahul@kitecoffee.test"),
    ("Orbit Fintech", "Sara Paul", "sara@orbitfintech.test"),
    ("Monsoon Media", "Neha Kapoor", None),
    ("Pixel Pantry", "Imran Shaikh", None),
    ("Greenleaf Trust", "Meera Joshi", "meera@greenleaf.test"),
]

# client, title, agreed, start (months back, day), days until due, work status,
# payments: (amount, months back, day, method). Three gigs still owe money:
# 18,000.00 + 12,500.00 + 42,750.00 = 73,250.00 outstanding, as in the approved design.
GIGS = [
    ("Northwind Studio", "Annual report design", "60000.00", (5, 2), 55, "delivered",
     [("15000.00", 5, 10, "bank_transfer"), ("15000.00", 4, 12, "bank_transfer"), ("12000.00", 3, 28, "upi"), ("18000.00", 2, 5, "bank_transfer")]),
    ("Northwind Studio", "Pitch deck refresh", "64000.00", (1, 2), 30, "delivered",
     [("32000.00", 1, 8, "bank_transfer"), ("32000.00", 1, 25, "bank_transfer")]),
    ("Northwind Studio", "Website copy", "18000.00", (0, 20), 16, "in_progress", []),
    ("Lumen Books", "Catalogue layout", "51500.00", (4, 1), 40, "delivered",
     [("25000.00", 4, 20, "bank_transfer"), ("26500.00", 3, 15, "bank_transfer")]),
    ("Lumen Books", "Brand refresh", "45000.00", (0, 1), 29, "in_progress",
     [("20000.00", 0, 3, "bank_transfer"), ("12500.00", 0, 15, "upi")]),
    ("Kite Coffee", "Packaging design", "50000.00", (6, 5), 45, "delivered",
     [("20000.00", 6, 25, "upi"), ("30000.00", 5, 20, "bank_transfer")]),
    ("Kite Coffee", "Menu illustrations", "24850.00", (2, 1), 30, "delivered", [("24850.00", 1, 2, "upi")]),
    ("Orbit Fintech", "Mobile app UI", "82750.00", (1, 10), 65, "in_progress", [("40000.00", 0, 8, "bank_transfer")]),
    ("Monsoon Media", "Podcast cover art", "12000.00", (7, 3), 10, "delivered", [("12000.00", 7, 15, "upi")]),
    ("Pixel Pantry", "Recipe app icons", "8500.00", (8, 1), 14, "delivered", [("8500.00", 8, 20, "card")]),
    ("Greenleaf Trust", "Donation page copy", "15000.00", (2, 10), 20, "delivered",
     [("7500.00", 2, 25, "bank_transfer"), ("7500.00", 1, 20, "cheque")]),
]

# The second account exists only to show the ownership check (its gig behaves as "not found").
OTHER_CLIENTS = [("Harbor Labs", "Kiran Das", None)]
OTHER_GIGS = [("Harbor Labs", "Landing page", "30000.00", (1, 5), 30, "in_progress", [("10000.00", 0, 2, "upi")])]


def months_back(today: date, count: int, day: int) -> date:
    """That day of the month `count` months before today's month (clamped to the month's length)."""
    month_start = first_of_month(today)
    for _ in range(count):
        month_start = first_of_month(month_start - timedelta(days=1))
    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    return month_start.replace(day=min(day, last_day))


async def remove_account(email: str) -> bool:
    """Deletes one account and everything it owns (files included). Returns whether it existed."""
    user = await user_repository.find_by_email(email)
    if user is None:
        return False
    user_id = user["_id"]

    await attachment_repository.delete_all_for_user(user_id)
    await payment_repository.delete_all_for_user(user_id)
    await gig_repository.delete_all_for_user(user_id)
    await client_repository.delete_all_for_user(user_id)
    await token_repository.delete_all_refresh_tokens(user_id)
    await token_repository.delete_all_reset_tokens(user_id)
    await user_repository.delete(user_id)
    return True


async def create_freelancer(name: str, email: str, password: str, is_demo: bool, clients=CLIENTS, gigs=GIGS) -> dict:
    """Creates a user with clients, gigs and payments. Returns a summary for the script's output."""
    today = today_in(TIME_ZONE)
    user = await user_repository.create(name, email, await hash_password(password), "INR", TIME_ZONE, is_demo=is_demo)
    user_id = user["_id"]

    client_ids = {}
    for client_name, contact_name, contact_email in clients:
        client = await client_repository.create(
            user_id, {"name": client_name, "contactName": contact_name, "contactEmail": contact_email, "notes": None}
        )
        client_ids[client_name] = client["_id"]

    payment_count = 0
    for client_name, title, agreed, (start_back, start_day), due_in_days, work_status, payments in gigs:
        start = months_back(today, start_back, start_day)
        gig = await gig_repository.create(
            user_id,
            {
                "clientId": client_ids[client_name],
                "title": title,
                "agreedAmount": Decimal(agreed),
                "startDate": to_datetime(start),
                "dueDate": to_datetime(start + timedelta(days=due_in_days)),
                "workStatus": work_status,
            },
        )
        for amount, back, day, method in payments:
            # Never in the future: early in a month, "the 15th" of this month hasn't happened yet.
            received_on = min(months_back(today, back, day), today)
            await gig_repository.add_to_paid_total(user_id, gig["_id"], Decimal(amount), session=None)
            await payment_repository.insert(user_id, gig, {"amount": Decimal(amount), "receivedOn": to_datetime(received_on), "method": method}, session=None)
            payment_count += 1

    return {"email": email, "clients": len(clients), "gigs": len(gigs), "payments": payment_count}
