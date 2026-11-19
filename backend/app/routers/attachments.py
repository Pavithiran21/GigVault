from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, Depends, Response

from app.core.auth import current_user_id
from app.services import attachment_service

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


def content_disposition(file_name: str) -> str:
    # An ASCII fallback name for old clients, and the real name (RFC 5987) for everyone else.
    fallback = "".join(c if c.isascii() and c.isprintable() and c not in '"\\' else "_" for c in file_name)
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(file_name, safe='')}"


@router.get("/{attachment_id}/download")
async def download_attachment(attachment_id: str, user_id: ObjectId = Depends(current_user_id)):
    attachment = await attachment_service.get_for_download(user_id, attachment_id)
    return Response(
        content=bytes(attachment["data"]),
        media_type=attachment["contentType"],
        headers={
            "Content-Disposition": content_disposition(attachment["fileName"]),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/{attachment_id}", status_code=204)
async def delete_attachment(attachment_id: str, user_id: ObjectId = Depends(current_user_id)):
    await attachment_service.delete(user_id, attachment_id)
    return Response(status_code=204)
