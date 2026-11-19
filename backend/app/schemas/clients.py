from datetime import datetime
from decimal import Decimal

from app.core.money import Money
from app.schemas.common import ApiModel
from app.schemas.fields import ClientName, Notes, OptionalEmail, ShortText


class ClientIn(ApiModel):
    name: ClientName
    contact_name: ShortText = None
    contact_email: OptionalEmail = None
    notes: Notes = None


class ClientOut(ApiModel):
    id: str
    name: str
    contact_name: str | None
    contact_email: str | None
    notes: str | None
    gig_count: int
    payment_count: int
    # What this client still owes over all its gigs, today.
    owed: Money
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_doc(cls, client: dict, gig_count: int, payment_count: int, owed: Decimal) -> "ClientOut":
        return cls(
            id=str(client["_id"]),
            name=client["name"],
            contact_name=client.get("contactName"),
            contact_email=client.get("contactEmail"),
            notes=client.get("notes"),
            gig_count=gig_count,
            payment_count=payment_count,
            owed=owed,
            created_at=client["createdAt"],
            updated_at=client["updatedAt"],
        )
