from datetime import date, datetime

from app.core.dates import to_date
from app.core.money import AmountIn, Money
from app.schemas.common import ApiModel
from app.schemas.fields import PaymentMethod
from app.schemas.gigs import GigOut


class PaymentIn(ApiModel):
    amount: AmountIn
    received_on: date
    method: PaymentMethod


class PaymentOut(ApiModel):
    id: str
    gig_id: str
    gig_title: str
    client_id: str
    client_name: str
    amount: Money
    received_on: date
    method: PaymentMethod
    created_at: datetime

    @classmethod
    def from_doc(cls, payment: dict, gig_title: str, client_name: str) -> "PaymentOut":
        return cls(
            id=str(payment["_id"]),
            gig_id=str(payment["gigId"]),
            gig_title=gig_title,
            client_id=str(payment["clientId"]),
            client_name=client_name,
            amount=payment["amount"],
            received_on=to_date(payment["receivedOn"]),
            method=payment["method"],
            created_at=payment["createdAt"],
        )


class PaymentCreatedOut(ApiModel):
    """The new payment and the gig after it, so the screen can say "Payment saved · ₹12,500.00 left"."""

    payment: PaymentOut
    gig: GigOut
