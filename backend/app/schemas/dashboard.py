from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import PlainSerializer

from app.core.money import Money
from app.schemas.common import ApiModel

# A percentage with one decimal, as text ("29.4"), like every other exact number in the API.
Percent = Annotated[Decimal, PlainSerializer(lambda value: str(value), return_type=str)]


class PeriodOut(ApiModel):
    type: Literal["month", "year", "custom"]
    start: date
    end: date


class MonthEarned(ApiModel):
    month: str
    earned: Money


class MonthSummary(ApiModel):
    month: str
    earned: Money
    payment_count: int


class YearSummary(ApiModel):
    year: int
    earned: Money
    payment_count: int


class OutstandingSummary(ApiModel):
    amount: Money
    gig_count: int


class ClientShare(ApiModel):
    client_id: str
    name: str
    earned: Money
    share: Percent


class OtherClientsShare(ApiModel):
    client_count: int
    earned: Money
    share: Percent


class IncomeShare(ApiModel):
    clients: list[ClientShare]
    others: OtherClientsShare | None


class TopClient(ApiModel):
    client_id: str
    name: str
    paid: Money
    owed: Money


class DashboardOut(ApiModel):
    currency: str
    time_zone: str
    period: PeriodOut
    # Everything below "period" covers only payments received in the period ...
    earned: Money
    payment_count: int
    client_count: int
    gig_count: int
    average_per_gig: Money
    best_month: MonthEarned | None
    trend: list[MonthEarned]
    income_share: IncomeShare
    top_clients: list[TopClient]
    # ... except these, which are always "now" in the user's time zone.
    this_month: MonthSummary
    this_year: YearSummary
    outstanding: OutstandingSummary
