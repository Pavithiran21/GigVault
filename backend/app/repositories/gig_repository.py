from decimal import Decimal

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.database import get_db
from app.core.dates import utc_now
from app.core.money import ZERO

TITLE_COLLATION = {"locale": "en", "strength": 2}


def _gigs():
    return get_db().gigs


async def create(user_id: ObjectId, fields: dict) -> dict:
    now = utc_now()
    # paidTotal starts at 0 and is changed only by payment_service, inside the same
    # transaction as the payment itself. It is never taken from a request.
    gig = {"userId": user_id, **fields, "paidTotal": ZERO, "createdAt": now, "updatedAt": now}
    result = await _gigs().insert_one(gig)
    gig["_id"] = result.inserted_id
    return gig


async def find(user_id: ObjectId, gig_id: ObjectId, session=None) -> dict | None:
    return await _gigs().find_one({"_id": gig_id, "userId": user_id}, session=session)


async def find_many(user_id: ObjectId, gig_ids: list[ObjectId]) -> dict[ObjectId, dict]:
    cursor = _gigs().find({"userId": user_id, "_id": {"$in": gig_ids}}, {"title": 1, "clientId": 1})
    return {gig["_id"]: gig async for gig in cursor}


async def list_page(query: dict, sort: list, skip: int, limit: int) -> tuple[list[dict], int]:
    """query must already contain userId (gig_service builds it)."""
    gigs = await _gigs().find(query, collation=TITLE_COLLATION).sort(sort).skip(skip).limit(limit).to_list()
    total = await _gigs().count_documents(query)
    return gigs, total


async def find_all(query: dict, sort: list, limit: int) -> list[dict]:
    return await _gigs().find(query, collation=TITLE_COLLATION).sort(sort).limit(limit).to_list()


async def update(user_id: ObjectId, gig_id: ObjectId, fields: dict, session=None) -> dict | None:
    """
    Updates a gig only if its new agreed amount is still at least what has been received.
    The check and the write are one atomic operation, so a payment arriving at the same time
    can't slip in between them. Returns None if the gig doesn't exist or the check fails.
    """
    return await _gigs().find_one_and_update(
        {
            "_id": gig_id,
            "userId": user_id,
            "$expr": {"$lte": ["$paidTotal", fields["agreedAmount"]]},
        },
        {"$set": {**fields, "updatedAt": utc_now()}},
        return_document=ReturnDocument.AFTER,
        session=session,
    )


async def add_to_paid_total(user_id: ObjectId, gig_id: ObjectId, amount: Decimal, session) -> dict | None:
    """
    Adds a payment to paidTotal only if it doesn't take the gig past its agreed amount.
    Returns the updated gig, or None if the gig doesn't exist or the payment is too big.
    """
    return await _gigs().find_one_and_update(
        {
            "_id": gig_id,
            "userId": user_id,
            "$expr": {"$lte": [{"$add": ["$paidTotal", amount]}, "$agreedAmount"]},
        },
        {"$inc": {"paidTotal": amount}, "$set": {"updatedAt": utc_now()}},
        return_document=ReturnDocument.AFTER,
        session=session,
    )


async def subtract_from_paid_total(user_id: ObjectId, gig_id: ObjectId, amount: Decimal, session) -> dict | None:
    return await _gigs().find_one_and_update(
        {"_id": gig_id, "userId": user_id},
        {"$inc": {"paidTotal": -amount}, "$set": {"updatedAt": utc_now()}},
        return_document=ReturnDocument.AFTER,
        session=session,
    )


async def delete(user_id: ObjectId, gig_id: ObjectId, session=None) -> bool:
    result = await _gigs().delete_one({"_id": gig_id, "userId": user_id}, session=session)
    return result.deleted_count == 1


async def count_for_client(user_id: ObjectId, client_id: ObjectId) -> int:
    return await _gigs().count_documents({"userId": user_id, "clientId": client_id})


async def totals_by_client(user_id: ObjectId, client_ids: list[ObjectId] | None = None) -> dict[ObjectId, dict]:
    """
    Per client: how many gigs, how much is still owed (agreed − received, summed exactly in
    Decimal128), and how many gigs still owe something.
    """
    match: dict = {"userId": user_id}
    if client_ids is not None:
        match["clientId"] = {"$in": client_ids}

    pipeline = [
        {"$match": match},
        {"$set": {"owed": {"$subtract": ["$agreedAmount", "$paidTotal"]}}},
        {
            "$group": {
                "_id": "$clientId",
                "gigCount": {"$sum": 1},
                "owed": {"$sum": "$owed"},
                "openGigCount": {"$sum": {"$cond": [{"$gt": ["$owed", 0]}, 1, 0]}},
            }
        },
    ]
    rows = await (await _gigs().aggregate(pipeline)).to_list()
    return {row["_id"]: row for row in rows}


async def delete_all_for_user(user_id: ObjectId) -> None:
    await _gigs().delete_many({"userId": user_id})
