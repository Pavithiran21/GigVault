from datetime import date, timedelta
from decimal import ROUND_HALF_UP

from bson import ObjectId

from app.core.dates import day_after, first_of_month, first_of_next_month, months_between, to_datetime, today_in
from app.core.errors import field_error
from app.core.money import CENT, ZERO, percent, to_money
from app.repositories import client_repository, gig_repository, payment_repository
from app.schemas.dashboard import (
    ClientShare,
    DashboardOut,
    IncomeShare,
    MonthEarned,
    MonthSummary,
    OtherClientsShare,
    OutstandingSummary,
    PeriodOut,
    TopClient,
    YearSummary,
)
from app.services import profile_service

SHARE_CLIENTS = 4  # "Where your income came from": 4 clients by name, the rest as "N other clients"
TOP_CLIENTS = 5
MAX_CUSTOM_DAYS = 5 * 366


def resolve_period(period: str, start: date | None, end: date | None, today: date) -> tuple[date, date]:
    """The first and last day (both included) of the period, with "today" in the user's time zone."""
    if period == "month":
        return first_of_month(today), first_of_next_month(today) - timedelta(days=1)
    if period == "year":
        return date(today.year, 1, 1), date(today.year, 12, 31)

    if start is None or end is None:
        raise field_error(400, "VALIDATION_FAILED", "from" if start is None else "to", "Pick a start and an end date.")
    if end < start:
        raise field_error(400, "VALIDATION_FAILED", "to", "The end date can't be before the start date.")
    if (end - start).days > MAX_CUSTOM_DAYS:
        raise field_error(400, "VALIDATION_FAILED", "to", "Pick a range of at most 5 years.")
    return start, end


async def get_dashboard(user_id: ObjectId, period: str, start: date | None, end: date | None) -> DashboardOut:
    """
    The signature feature. Every total is summed by MongoDB on Decimal128 values (exact decimal
    arithmetic, no float anywhere) and only rounded to 2 places for display, so the dashboard
    matches a hand calculation to the cent.
    """
    user = await profile_service.get_profile(user_id)
    today = today_in(user["timeZone"])
    period_start, period_end = resolve_period(period, start, end, today)

    breakdown = await payment_repository.period_breakdown(user_id, to_datetime(period_start), day_after(period_end))
    totals = breakdown["totals"][0] if breakdown["totals"] else {"earned": 0, "paymentCount": 0, "clientCount": 0, "gigCount": 0}
    earned = to_money(totals["earned"])
    gig_count = totals["gigCount"]

    # Every month of the period appears in the trend, with 0.00 for a month without payments.
    earned_by_month = {row["_id"]: row["earned"] for row in breakdown["byMonth"]}
    trend = [MonthEarned(month=month, earned=to_money(earned_by_month.get(month, 0))) for month in months_between(period_start, period_end)]
    best_month = None
    for month in trend:
        if month.earned > 0 and (best_month is None or month.earned > best_month.earned):
            best_month = month

    # Owed is "today", over every gig, not only the period's.
    owed_by_client = await gig_repository.totals_by_client(user_id)
    by_client = breakdown["byClient"]  # sorted by earned, highest first
    named_ids = [row["_id"] for row in by_client[: max(SHARE_CLIENTS, TOP_CLIENTS)]]
    names = await client_repository.find_names(user_id, named_ids)

    income_share = _income_share(by_client, names, earned)
    top_clients = [
        TopClient(
            client_id=str(row["_id"]),
            name=names.get(row["_id"], ""),
            paid=to_money(row["earned"]),
            owed=to_money(owed_by_client.get(row["_id"], {}).get("owed", 0)),
        )
        for row in by_client[:TOP_CLIENTS]
    ]

    month_earned, month_count = await payment_repository.sum_received(
        user_id, to_datetime(first_of_month(today)), to_datetime(first_of_next_month(today))
    )
    year_earned, year_count = await payment_repository.sum_received(
        user_id, to_datetime(date(today.year, 1, 1)), to_datetime(date(today.year + 1, 1, 1))
    )
    outstanding = sum((row["owed"] for row in owed_by_client.values()), ZERO)
    open_gigs = sum(row["openGigCount"] for row in owed_by_client.values())

    return DashboardOut(
        currency=user["defaultCurrency"],
        time_zone=user["timeZone"],
        period=PeriodOut(type=period, start=period_start, end=period_end),
        earned=earned,
        payment_count=totals["paymentCount"],
        client_count=totals["clientCount"],
        gig_count=gig_count,
        # Average earned per gig that was paid in the period, rounded half up to the cent.
        average_per_gig=(earned / gig_count).quantize(CENT, rounding=ROUND_HALF_UP) if gig_count else ZERO,
        best_month=best_month,
        trend=trend,
        income_share=income_share,
        top_clients=top_clients,
        this_month=MonthSummary(month=f"{today.year:04d}-{today.month:02d}", earned=to_money(month_earned), payment_count=month_count),
        this_year=YearSummary(year=today.year, earned=to_money(year_earned), payment_count=year_count),
        outstanding=OutstandingSummary(amount=to_money(outstanding), gig_count=open_gigs),
    )


def _income_share(by_client: list[dict], names: dict, earned) -> IncomeShare:
    if earned == 0:
        return IncomeShare(clients=[], others=None)

    clients = [
        ClientShare(
            client_id=str(row["_id"]),
            name=names.get(row["_id"], ""),
            earned=to_money(row["earned"]),
            share=percent(row["earned"], earned),
        )
        for row in by_client[:SHARE_CLIENTS]
    ]
    rest = by_client[SHARE_CLIENTS:]
    others = None
    if rest:
        rest_earned = sum((row["earned"] for row in rest), ZERO)
        others = OtherClientsShare(client_count=len(rest), earned=to_money(rest_earned), share=percent(rest_earned, earned))
    return IncomeShare(clients=clients, others=others)
