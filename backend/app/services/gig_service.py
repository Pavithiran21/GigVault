import re
from dataclasses import dataclass
from datetime import date

from bson import ObjectId
from bson.errors import InvalidId

from app.core.database import parse_object_id, run_in_transaction
from app.core.dates import to_datetime
from app.core.errors import field_error, not_found
from app.core.money import display_amount
from app.core.pagination import PageParams, parse_sort, to_page
from app.core.payment_status import payment_status_filter
from app.repositories import attachment_repository, client_repository, gig_repository, payment_repository, user_repository
from app.schemas.gigs import GigDetailOut, GigIn, GigOut

GIG_SORT_FIELDS = ["startDate", "dueDate", "createdAt", "agreedAmount", "title"]


@dataclass
class GigFilters:
    client_id: str | None = None
    work_status: str | None = None
    payment_status: str | None = None
    start: date | None = None
    end: date | None = None
    search: str | None = None


def build_query(user_id: ObjectId, filters: GigFilters) -> dict:
    """The gigs list and the CSV export use the same filters, built here once."""
    query: dict = {"userId": user_id}

    if filters.client_id:
        try:
            query["clientId"] = ObjectId(filters.client_id)
        except InvalidId:
            raise field_error(400, "VALIDATION_FAILED", "clientId", "Pick one of your clients.") from None
    if filters.work_status:
        query["workStatus"] = filters.work_status
    if filters.payment_status:
        query.update(payment_status_filter(filters.payment_status))

    # A date range keeps the gigs that overlap it: started before it ends, due after it starts.
    if filters.start and filters.end and filters.end < filters.start:
        raise field_error(400, "VALIDATION_FAILED", "to", "The end date can't be before the start date.")
    if filters.end:
        query["startDate"] = {"$lte": to_datetime(filters.end)}
    if filters.start:
        query["dueDate"] = {"$gte": to_datetime(filters.start)}

    if filters.search:
        query["title"] = {"$regex": re.escape(filters.search), "$options": "i"}
    return query


def _fields(data: GigIn, client_id: ObjectId) -> dict:
    return {
        "clientId": client_id,
        "title": data.title,
        "agreedAmount": data.agreed_amount,
        "startDate": to_datetime(data.start_date),
        "dueDate": to_datetime(data.due_date),
        "workStatus": data.work_status,
    }


async def _own_client_id(user_id: ObjectId, client_id: str) -> ObjectId:
    # Another user's client id gets the same answer as one that doesn't exist.
    try:
        parsed = ObjectId(client_id)
    except InvalidId:
        parsed = None
    if parsed is None or await client_repository.find(user_id, parsed) is None:
        raise field_error(400, "VALIDATION_FAILED", "clientId", "Pick one of your clients.")
    return parsed


async def find_or_404(user_id: ObjectId, gig_id: str) -> dict:
    gig = await gig_repository.find(user_id, parse_object_id(gig_id, "Gig"))
    if gig is None:
        raise not_found("Gig")
    return gig


async def to_out(user_id: ObjectId, gigs: list[dict]) -> list[GigOut]:
    names = await client_repository.find_names(user_id, list({gig["clientId"] for gig in gigs}))
    return [GigOut.from_doc(gig, names.get(gig["clientId"], "")) for gig in gigs]


async def create(user_id: ObjectId, data: GigIn) -> GigOut:
    client_id = await _own_client_id(user_id, data.client_id)
    gig = await gig_repository.create(user_id, _fields(data, client_id))
    return (await to_out(user_id, [gig]))[0]


async def get_detail(user_id: ObjectId, gig_id: str) -> GigDetailOut:
    gig = await find_or_404(user_id, gig_id)
    names = await client_repository.find_names(user_id, [gig["clientId"]])
    return GigDetailOut(
        **GigOut.fields_from_doc(gig, names.get(gig["clientId"], "")),
        payment_count=await payment_repository.count_for_gig(user_id, gig["_id"]),
        attachment_count=await attachment_repository.count_for_gig(user_id, gig["_id"]),
    )


async def list_page(user_id: ObjectId, params: PageParams, filters: GigFilters) -> dict:
    sort = parse_sort(params.sort, GIG_SORT_FIELDS, "-startDate")
    gigs, total = await gig_repository.list_page(build_query(user_id, filters), sort, params.skip, params.size)
    return to_page(await to_out(user_id, gigs), total, params)


async def update(user_id: ObjectId, gig_id: str, data: GigIn) -> GigOut:
    gig = await find_or_404(user_id, gig_id)
    client_id = await _own_client_id(user_id, data.client_id)
    fields = _fields(data, client_id)

    if client_id == gig["clientId"]:
        updated = await gig_repository.update(user_id, gig["_id"], fields)
    else:
        # Payments carry their gig's client for the dashboard, so moving the gig moves them too,
        # in one transaction: the totals per client never see a half-moved gig.
        async def work(session):
            moved = await gig_repository.update(user_id, gig["_id"], fields, session=session)
            if moved is not None:
                await payment_repository.move_gig_to_client(user_id, gig["_id"], client_id, session)
            return moved

        updated = await run_in_transaction(work)

    if updated is None:
        # The gig exists (found above), so the guard failed: more has been received than the new amount.
        user = await user_repository.find_by_id(user_id)
        received = display_amount(gig["paidTotal"], user["defaultCurrency"])
        message = f"The agreed amount can't be less than the {received} already received."
        raise field_error(422, "AGREED_BELOW_RECEIVED", "agreedAmount", message)
    return (await to_out(user_id, [updated]))[0]


async def delete(user_id: ObjectId, gig_id: str) -> None:
    """Deletes a gig with its payments and files. The files are part of the attachment documents, so one transaction covers all of it."""
    gig = await find_or_404(user_id, gig_id)

    async def work(session):
        await payment_repository.delete_for_gig(user_id, gig["_id"], session)
        await attachment_repository.delete_for_gig(user_id, gig["_id"], session)
        await gig_repository.delete(user_id, gig["_id"], session)

    await run_in_transaction(work)
