from bson import Binary, ObjectId
from pymongo import DESCENDING

from app.core.database import get_db
from app.core.dates import utc_now

# The file bytes live in the "data" field of the same document. Every query that only needs the
# details leaves it out, so listing files never loads them.
WITHOUT_DATA = {"data": 0}


def _attachments():
    return get_db().attachments


async def insert(user_id: ObjectId, gig_id: ObjectId, file_name: str, content_type: str, content: bytes) -> dict:
    attachment = {
        "userId": user_id,
        "gigId": gig_id,
        "fileName": file_name,
        "contentType": content_type,
        "size": len(content),
        "data": Binary(content),
        "createdAt": utc_now(),
    }
    result = await _attachments().insert_one(attachment)
    attachment["_id"] = result.inserted_id
    del attachment["data"]
    return attachment


async def find(user_id: ObjectId, attachment_id: ObjectId) -> dict | None:
    """The attachment with its bytes, for download. Always filtered by owner."""
    return await _attachments().find_one({"_id": attachment_id, "userId": user_id})


async def find_details(user_id: ObjectId, attachment_id: ObjectId) -> dict | None:
    return await _attachments().find_one({"_id": attachment_id, "userId": user_id}, WITHOUT_DATA)


async def list_page(user_id: ObjectId, gig_id: ObjectId, skip: int, limit: int) -> tuple[list[dict], int]:
    query = {"userId": user_id, "gigId": gig_id}
    cursor = _attachments().find(query, WITHOUT_DATA).sort([("createdAt", DESCENDING), ("_id", DESCENDING)]).skip(skip).limit(limit)
    attachments = await cursor.to_list()
    total = await _attachments().count_documents(query)
    return attachments, total


async def count_for_gig(user_id: ObjectId, gig_id: ObjectId) -> int:
    return await _attachments().count_documents({"userId": user_id, "gigId": gig_id})


async def delete(user_id: ObjectId, attachment_id: ObjectId) -> None:
    await _attachments().delete_one({"_id": attachment_id, "userId": user_id})


async def delete_for_gig(user_id: ObjectId, gig_id: ObjectId, session=None) -> None:
    await _attachments().delete_many({"userId": user_id, "gigId": gig_id}, session=session)


async def delete_all_for_user(user_id: ObjectId) -> None:
    await _attachments().delete_many({"userId": user_id})
