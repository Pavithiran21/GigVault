from datetime import date

from bson import ObjectId
from bson.errors import InvalidId

from app.core.database import parse_object_id, run_in_transaction
from app.core.dates import day_after, to_datetime, today_in
from app.core.errors import field_error, not_found
from app.core.money import display_amount
from app.core.pagination import PageParams, parse_sort, to_page
from app.repositories import client_repository, gig_repository, payment_repository, user_repository
from app.schemas.gigs import GigOut
from app.schemas.payments import PaymentCreatedOut, PaymentIn, PaymentOut
from app.services import gig_service

PAYMENT_SORT_FIELDS = ["receivedOn", "amount", "createdAt"]


async def _to_out(user_id: ObjectId, payments: list[dict]) -> list[PaymentOut]:
    gigs = await gig_repository.find_many(user_id, list({payment["gigId"] for payment in payments}))
    names = await client_repository.find_names(user_id, list({payment["clientId"] for payment in payments}))
    return [
        PaymentOut.from_doc(
            payment,
            gig_title=gigs.get(payment["gigId"], {}).get("title", ""),
            client_name=names.get(payment["clientId"], ""),
        )
        for payment in payments
    ]


async def record(user_id: ObjectId, gig_id: str, data: PaymentIn) -> PaymentCreatedOut:
    """
    Records a payment and adds it to the gig's paidTotal in one transaction.

    The overpayment check is part of the update itself (add only if paidTotal + amount <=
    agreedAmount), so it is atomic. If two payments for the same gig race, both transactions
    write the same gig document: MongoDB lets one commit and aborts the other with a write
    conflict, with_transaction runs it again, and the re-run sees the first payment and is
    refused if the two together would be too much. The gig can never be overpaid.
    """
    gig_object_id = parse_object_id(gig_id, "Gig")
    user = await user_repository.find_by_id(user_id)

    # "Today" is the user's own date, not the server's.
    if data.received_on > today_in(user["timeZone"]):
        raise field_error(400, "VALIDATION_FAILED", "receivedOn", "That date is in the future.")

    fields = {"amount": data.amount, "receivedOn": to_datetime(data.received_on), "method": data.method}

    async def work(session):
        gig = await gig_repository.add_to_paid_total(user_id, gig_object_id, data.amount, session)
        if gig is None:
            existing = await gig_repository.find(user_id, gig_object_id, session)
            if existing is None:
                raise not_found("Gig")
            owed = existing["agreedAmount"] - existing["paidTotal"]
            if owed <= 0:
                raise field_error(422, "PAYMENT_EXCEEDS_OUTSTANDING", "amount", "This gig is already paid in full.")
            message = f"That's more than the {display_amount(owed, user['defaultCurrency'])} still owed."
            raise field_error(422, "PAYMENT_EXCEEDS_OUTSTANDING", "amount", message)

        payment = await payment_repository.insert(user_id, gig, fields, session)
        return gig, payment

    gig, payment = await run_in_transaction(work)
    client_name = (await client_repository.find_names(user_id, [gig["clientId"]])).get(gig["clientId"], "")
    return PaymentCreatedOut(
        payment=PaymentOut.from_doc(payment, gig_title=gig["title"], client_name=client_name),
        gig=GigOut.from_doc(gig, client_name),
    )


async def delete(user_id: ObjectId, payment_id: str) -> None:
    """Deletes a payment and takes exactly its amount off the gig's paidTotal, in one transaction."""
    payment_object_id = parse_object_id(payment_id, "Payment")

    async def work(session):
        payment = await payment_repository.find(user_id, payment_object_id, session)
        if payment is None:
            raise not_found("Payment")
        await payment_repository.delete(user_id, payment_object_id, session)
        await gig_repository.subtract_from_paid_total(user_id, payment["gigId"], payment["amount"], session)

    await run_in_transaction(work)


async def list_for_gig(user_id: ObjectId, gig_id: str, params: PageParams) -> dict:
    gig = await gig_service.find_or_404(user_id, gig_id)
    sort = parse_sort(params.sort, PAYMENT_SORT_FIELDS, "-receivedOn")
    payments, total = await payment_repository.list_page({"userId": user_id, "gigId": gig["_id"]}, sort, params.skip, params.size)
    return to_page(await _to_out(user_id, payments), total, params)


async def list_all(user_id: ObjectId, params: PageParams, client_id: str | None, start: date | None, end: date | None) -> dict:
    query: dict = {"userId": user_id}
    if client_id:
        try:
            query["clientId"] = ObjectId(client_id)
        except InvalidId:
            raise field_error(400, "VALIDATION_FAILED", "clientId", "Pick one of your clients.") from None
    if start and end and end < start:
        raise field_error(400, "VALIDATION_FAILED", "to", "The end date can't be before the start date.")
    if start or end:
        query["receivedOn"] = {}
        if start:
            query["receivedOn"]["$gte"] = to_datetime(start)
        if end:
            query["receivedOn"]["$lt"] = day_after(end)

    sort = parse_sort(params.sort, PAYMENT_SORT_FIELDS, "-receivedOn")
    payments, total = await payment_repository.list_page(query, sort, params.skip, params.size)
    return to_page(await _to_out(user_id, payments), total, params)
