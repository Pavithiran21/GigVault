from bson import ObjectId
from starlette.datastructures import UploadFile

from app.core.database import parse_object_id
from app.core.errors import AppError, not_found
from app.core.file_types import detect_content_type
from app.core.pagination import PageParams, to_page
from app.repositories import attachment_repository
from app.schemas.attachments import AttachmentOut
from app.services import gig_service

MAX_FILE_BYTES = 10 * 1024 * 1024
# The usual file-system limit for a file name.
MAX_FILE_NAME_LENGTH = 255


def clean_file_name(raw: str | None) -> str:
    """
    The name is only shown and sent back in Content-Disposition, never used as a path. Old
    browsers send a full path, so only its last part is kept, and a long name is cut to 255
    characters, keeping its extension.
    """
    name = (raw or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not name:
        return "file"
    if len(name) <= MAX_FILE_NAME_LENGTH:
        return name
    stem, dot, extension = name.rpartition(".")
    if dot and len(extension) <= 10:
        return stem[: MAX_FILE_NAME_LENGTH - len(extension) - 1] + "." + extension
    return name[:MAX_FILE_NAME_LENGTH]


async def upload(user_id: ObjectId, gig_id: str, file: UploadFile) -> AttachmentOut:
    """
    Ownership first: the gig must be the user's. Then the real file type and size are checked
    and the file is stored inside the attachment document in MongoDB (10 MB fits the 16 MB
    document limit).
    """
    gig = await gig_service.find_or_404(user_id, gig_id)

    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise AppError(413, "FILE_TOO_LARGE", "File is larger than 10 MB.")
    if not content:
        raise AppError(400, "EMPTY_FILE", "The file is empty.")

    content_type = detect_content_type(content)
    if content_type is None:
        raise AppError(415, "FILE_TYPE_NOT_ALLOWED", "File type not allowed. Use PDF, DOCX, PNG or JPG.")

    attachment = await attachment_repository.insert(user_id, gig["_id"], clean_file_name(file.filename), content_type, content)
    return AttachmentOut.from_doc(attachment)


async def list_page(user_id: ObjectId, gig_id: str, params: PageParams) -> dict:
    gig = await gig_service.find_or_404(user_id, gig_id)
    attachments, total = await attachment_repository.list_page(user_id, gig["_id"], params.skip, params.size)
    return to_page([AttachmentOut.from_doc(attachment) for attachment in attachments], total, params)


async def get_for_download(user_id: ObjectId, attachment_id: str) -> dict:
    # Filtered by owner in the query itself: someone else's file is a 404, same as a missing one.
    attachment = await attachment_repository.find(user_id, parse_object_id(attachment_id, "File"))
    if attachment is None:
        raise not_found("File")
    return attachment


async def delete(user_id: ObjectId, attachment_id: str) -> None:
    attachment = await attachment_repository.find_details(user_id, parse_object_id(attachment_id, "File"))
    if attachment is None:
        raise not_found("File")
    await attachment_repository.delete(user_id, attachment["_id"])
