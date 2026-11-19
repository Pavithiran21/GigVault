from datetime import date, datetime

from pydantic import ValidationInfo, field_validator
from pydantic_core import PydanticCustomError

from app.core.dates import to_date
from app.core.money import AmountIn, Money
from app.core.payment_status import payment_status
from app.schemas.common import ApiModel
from app.schemas.fields import GigTitle, PaymentStatus, WorkStatus


class GigIn(ApiModel):
    client_id: str
    title: GigTitle
    agreed_amount: AmountIn
    start_date: date
    due_date: date
    # Set by the user. The payment status is never sent: it is worked out from the payments.
    work_status: WorkStatus = "pending"

    @field_validator("due_date")
    @classmethod
    def due_not_before_start(cls, due_date: date, info: ValidationInfo) -> date:
        start_date = info.data.get("start_date")
        if start_date is not None and due_date < start_date:
            raise PydanticCustomError("due_before_start", "Due date can't be before the start date.")
        return due_date


class GigOut(ApiModel):
    id: str
    client_id: str
    client_name: str
    title: str
    agreed_amount: Money
    received_amount: Money
    outstanding: Money
    payment_status: PaymentStatus
    work_status: WorkStatus
    start_date: date
    due_date: date
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def fields_from_doc(gig: dict, client_name: str) -> dict:
        agreed = gig["agreedAmount"]
        paid = gig["paidTotal"]
        return {
            "id": str(gig["_id"]),
            "client_id": str(gig["clientId"]),
            "client_name": client_name,
            "title": gig["title"],
            "agreed_amount": agreed,
            "received_amount": paid,
            "outstanding": agreed - paid,
            "payment_status": payment_status(agreed, paid),
            "work_status": gig["workStatus"],
            "start_date": to_date(gig["startDate"]),
            "due_date": to_date(gig["dueDate"]),
            "created_at": gig["createdAt"],
            "updated_at": gig["updatedAt"],
        }

    @classmethod
    def from_doc(cls, gig: dict, client_name: str) -> "GigOut":
        return cls(**cls.fields_from_doc(gig, client_name))


class GigDetailOut(GigOut):
    payment_count: int
    attachment_count: int
