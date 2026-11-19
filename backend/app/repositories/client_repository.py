import re

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.database import get_db
from app.core.dates import utc_now

# Sorts "anita" and "Anita" together instead of putting every capital letter first.
NAME_COLLATION = {"locale": "en", "strength": 2}


def _clients():
    return get_db().clients


async def create(user_id: ObjectId, fields: dict) -> dict:
    now = utc_now()
    client = {"userId": user_id, **fields, "createdAt": now, "updatedAt": now}
    result = await _clients().insert_one(client)
    client["_id"] = result.inserted_id
    return client


async def find(user_id: ObjectId, client_id: ObjectId, session=None) -> dict | None:
    return await _clients().find_one({"_id": client_id, "userId": user_id}, session=session)


async def find_names(user_id: ObjectId, client_ids: list[ObjectId]) -> dict[ObjectId, str]:
    cursor = _clients().find({"userId": user_id, "_id": {"$in": client_ids}}, {"name": 1})
    return {client["_id"]: client["name"] async for client in cursor}


async def list_page(user_id: ObjectId, search: str | None, sort: list, skip: int, limit: int) -> tuple[list[dict], int]:
    query: dict = {"userId": user_id}
    if search:
        # re.escape: the search box is plain text, never a pattern the user can abuse.
        query["name"] = {"$regex": re.escape(search), "$options": "i"}

    cursor = _clients().find(query, collation=NAME_COLLATION).sort(sort).skip(skip).limit(limit)
    clients = await cursor.to_list()
    total = await _clients().count_documents(query)
    return clients, total


async def update(user_id: ObjectId, client_id: ObjectId, fields: dict) -> dict | None:
    return await _clients().find_one_and_update(
        {"_id": client_id, "userId": user_id},
        {"$set": {**fields, "updatedAt": utc_now()}},
        return_document=ReturnDocument.AFTER,
    )


async def delete(user_id: ObjectId, client_id: ObjectId) -> bool:
    result = await _clients().delete_one({"_id": client_id, "userId": user_id})
    return result.deleted_count == 1


async def delete_all_for_user(user_id: ObjectId) -> None:
    await _clients().delete_many({"userId": user_id})
