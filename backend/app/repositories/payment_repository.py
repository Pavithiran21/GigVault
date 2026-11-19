from datetime import datetime

from bson import ObjectId

from app.core.database import get_db
from app.core.dates import utc_now


def _payments():
    return get_db().payments


async def insert(user_id: ObjectId, gig: dict, fields: dict, session) -> dict:
    # clientId is copied from the gig so the dashboard can group payments by client without a
    # join. gig_service keeps it in step if a gig is moved to another client.
    payment = {"userId": user_id, "gigId": gig["_id"], "clientId": gig["clientId"], **fields, "createdAt": utc_now()}
    result = await _payments().insert_one(payment, session=session)
    payment["_id"] = result.inserted_id
    return payment


async def find(user_id: ObjectId, payment_id: ObjectId, session=None) -> dict | None:
    return await _payments().find_one({"_id": payment_id, "userId": user_id}, session=session)


async def delete(user_id: ObjectId, payment_id: ObjectId, session) -> bool:
    result = await _payments().delete_one({"_id": payment_id, "userId": user_id}, session=session)
    return result.deleted_count == 1


async def list_page(query: dict, sort: list, skip: int, limit: int) -> tuple[list[dict], int]:
    """query must already contain userId (payment_service builds it)."""
    payments = await _payments().find(query).sort(sort).skip(skip).limit(limit).to_list()
    total = await _payments().count_documents(query)
    return payments, total


async def count_for_gig(user_id: ObjectId, gig_id: ObjectId) -> int:
    return await _payments().count_documents({"userId": user_id, "gigId": gig_id})


async def counts_by_client(user_id: ObjectId, client_ids: list[ObjectId]) -> dict[ObjectId, int]:
    pipeline = [
        {"$match": {"userId": user_id, "clientId": {"$in": client_ids}}},
        {"$group": {"_id": "$clientId", "count": {"$sum": 1}}},
    ]
    rows = await (await _payments().aggregate(pipeline)).to_list()
    return {row["_id"]: row["count"] for row in rows}


async def move_gig_to_client(user_id: ObjectId, gig_id: ObjectId, client_id: ObjectId, session) -> None:
    await _payments().update_many({"userId": user_id, "gigId": gig_id}, {"$set": {"clientId": client_id}}, session=session)


async def delete_for_gig(user_id: ObjectId, gig_id: ObjectId, session) -> None:
    await _payments().delete_many({"userId": user_id, "gigId": gig_id}, session=session)


async def delete_all_for_user(user_id: ObjectId) -> None:
    await _payments().delete_many({"userId": user_id})


async def sum_received(user_id: ObjectId, start: datetime, end: datetime) -> tuple[object, int]:
    """Exact total and count of payments received in [start, end). An empty $sum is 0."""
    pipeline = [
        {"$match": {"userId": user_id, "receivedOn": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": None, "earned": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    rows = await (await _payments().aggregate(pipeline)).to_list()
    if not rows:
        return 0, 0
    return rows[0]["earned"], rows[0]["count"]


async def period_breakdown(user_id: ObjectId, start: datetime, end: datetime) -> dict:
    """
    One pass over the payments received in [start, end), split three ways with $facet:
    the totals, the total per month and the total per client. Every $sum runs on Decimal128.
    """
    pipeline = [
        {"$match": {"userId": user_id, "receivedOn": {"$gte": start, "$lt": end}}},
        {
            "$facet": {
                "totals": [
                    {
                        "$group": {
                            "_id": None,
                            "earned": {"$sum": "$amount"},
                            "paymentCount": {"$sum": 1},
                            "clients": {"$addToSet": "$clientId"},
                            "gigs": {"$addToSet": "$gigId"},
                        }
                    },
                    {
                        "$project": {
                            "earned": 1,
                            "paymentCount": 1,
                            "clientCount": {"$size": "$clients"},
                            "gigCount": {"$size": "$gigs"},
                        }
                    },
                ],
                # receivedOn is midnight UTC of the payment's date, so the UTC month is its month.
                "byMonth": [
                    {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$receivedOn"}}, "earned": {"$sum": "$amount"}}},
                    {"$sort": {"_id": 1}},
                ],
                "byClient": [
                    {"$group": {"_id": "$clientId", "earned": {"$sum": "$amount"}}},
                    {"$sort": {"earned": -1, "_id": 1}},
                ],
            }
        },
    ]
    rows = await (await _payments().aggregate(pipeline)).to_list()
    return rows[0]
