from datetime import UTC, date, datetime, timedelta
from functools import lru_cache
from zoneinfo import ZoneInfo, available_timezones

# Calendar dates (a gig's start and due dates, the day a payment was received) are stored as
# midnight UTC of that date. They are dates, not moments, so they never move with a time zone.
# The user's time zone is used only to work out what "today" and "this month" are for them.


def to_datetime(value: date) -> datetime:
    return datetime(value.year, value.month, value.day, tzinfo=UTC)


def to_date(value: datetime) -> date:
    return value.astimezone(UTC).date()


def day_after(value: date) -> datetime:
    """The exclusive upper bound for "up to and including this date": midnight UTC of the next day."""
    return to_datetime(value) + timedelta(days=1)


def utc_now() -> datetime:
    return datetime.now(UTC)


def today_in(time_zone: str) -> date:
    return datetime.now(ZoneInfo(time_zone)).date()


def first_of_month(value: date) -> date:
    return value.replace(day=1)


def first_of_next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def months_between(start: date, end: date) -> list[str]:
    """Every month from start's month to end's month, as "2026-01" keys."""
    months = []
    current = first_of_month(start)
    while current <= end:
        months.append(f"{current.year:04d}-{current.month:02d}")
        current = first_of_next_month(current)
    return months


@lru_cache
def known_time_zones() -> frozenset[str]:
    # From the tzdata package: Windows has no IANA time zone database of its own.
    return frozenset(available_timezones())
