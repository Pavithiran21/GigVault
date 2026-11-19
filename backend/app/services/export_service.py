import csv
import io

from bson import ObjectId

from app.core.dates import today_in
from app.core.money import format_money
from app.core.pagination import parse_sort
from app.repositories import gig_repository
from app.schemas.gigs import GigOut
from app.services import gig_service, profile_service
from app.services.gig_service import GIG_SORT_FIELDS, GigFilters

MAX_ROWS = 10_000
WORK_STATUS_LABELS = {"pending": "Pending", "in_progress": "In progress", "delivered": "Delivered"}
PAYMENT_STATUS_LABELS = {"unpaid": "Unpaid", "partly_paid": "Part paid", "paid": "Paid"}

# A spreadsheet runs a cell that starts with one of these as a formula ("CSV injection"):
# a gig titled =HYPERLINK(...) could send data elsewhere. Such cells get a leading ' so they
# show as plain text.
FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value: str) -> str:
    return "'" + value if value.startswith(FORMULA_STARTS) else value


async def gigs_csv(user_id: ObjectId, filters: GigFilters, sort: str | None) -> tuple[str, str, int]:
    """The gigs matching the list filters as CSV. Returns (file name, CSV text, row count)."""
    user = await profile_service.get_profile(user_id)
    query = gig_service.build_query(user_id, filters)
    gigs = await gig_repository.find_all(query, parse_sort(sort, GIG_SORT_FIELDS, "-startDate"), MAX_ROWS)
    rows = await gig_service.to_out(user_id, gigs)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Title", "Client", "Work status", "Payment status", "Currency", "Agreed", "Received", "Outstanding", "Start date", "Due date"])
    for gig in rows:
        writer.writerow(_row(gig, user["defaultCurrency"]))

    file_name = f"gigvault-gigs-{today_in(user['timeZone']).isoformat()}.csv"
    # The byte-order mark makes Excel read the file as UTF-8 (₹ and accented names).
    return file_name, "﻿" + buffer.getvalue(), len(rows)


def _row(gig: GigOut, currency: str) -> list[str]:
    return [
        safe_cell(gig.title),
        safe_cell(gig.client_name),
        WORK_STATUS_LABELS[gig.work_status],
        PAYMENT_STATUS_LABELS[gig.payment_status],
        currency,
        format_money(gig.agreed_amount),
        format_money(gig.received_amount),
        format_money(gig.outstanding),
        gig.start_date.isoformat(),
        gig.due_date.isoformat(),
    ]
