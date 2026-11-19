from datetime import date

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Request, Response
from starlette.datastructures import UploadFile

from app.core.auth import current_user_id
from app.core.errors import AppError, field_error
from app.core.pagination import Page, PageParams
from app.schemas.attachments import AttachmentOut
from app.schemas.fields import PaymentStatus, WorkStatus
from app.schemas.gigs import GigDetailOut, GigIn, GigOut
from app.schemas.payments import PaymentCreatedOut, PaymentIn, PaymentOut
from app.services import attachment_service, gig_service, payment_service
from app.services.attachment_service import MAX_FILE_BYTES
from app.services.gig_service import GigFilters

router = APIRouter(prefix="/api/gigs", tags=["gigs"])

# Room for the multipart boundaries and headers around a 10 MB file.
FORM_OVERHEAD_BYTES = 64 * 1024


def gig_filters(
    client_id: str | None = Query(None, alias="clientId", max_length=24),
    work_status: WorkStatus | None = Query(None, alias="workStatus"),
    payment_status: PaymentStatus | None = Query(None, alias="paymentStatus"),
    start: date | None = Query(None, alias="from"),
    end: date | None = Query(None, alias="to"),
    q: str | None = Query(None, max_length=100),
) -> GigFilters:
    """The same filters for the gigs list and the CSV export."""
    return GigFilters(client_id=client_id, work_status=work_status, payment_status=payment_status, start=start, end=end, search=q)


@router.get("", response_model=Page[GigOut])
async def list_gigs(
    params: PageParams = Depends(),
    filters: GigFilters = Depends(gig_filters),
    user_id: ObjectId = Depends(current_user_id),
):
    return await gig_service.list_page(user_id, params, filters)


@router.post("", status_code=201, response_model=GigOut)
async def create_gig(data: GigIn, user_id: ObjectId = Depends(current_user_id)):
    return await gig_service.create(user_id, data)


@router.get("/{gig_id}", response_model=GigDetailOut)
async def get_gig(gig_id: str, user_id: ObjectId = Depends(current_user_id)):
    return await gig_service.get_detail(user_id, gig_id)


@router.put("/{gig_id}", response_model=GigOut)
async def update_gig(gig_id: str, data: GigIn, user_id: ObjectId = Depends(current_user_id)):
    return await gig_service.update(user_id, gig_id, data)


@router.delete("/{gig_id}", status_code=204)
async def delete_gig(gig_id: str, user_id: ObjectId = Depends(current_user_id)):
    await gig_service.delete(user_id, gig_id)
    return Response(status_code=204)


@router.get("/{gig_id}/payments", response_model=Page[PaymentOut])
async def list_gig_payments(gig_id: str, params: PageParams = Depends(), user_id: ObjectId = Depends(current_user_id)):
    return await payment_service.list_for_gig(user_id, gig_id, params)


@router.post("/{gig_id}/payments", status_code=201, response_model=PaymentCreatedOut)
async def record_payment(gig_id: str, data: PaymentIn, user_id: ObjectId = Depends(current_user_id)):
    return await payment_service.record(user_id, gig_id, data)


@router.get("/{gig_id}/attachments", response_model=Page[AttachmentOut])
async def list_attachments(gig_id: str, params: PageParams = Depends(), user_id: ObjectId = Depends(current_user_id)):
    return await attachment_service.list_page(user_id, gig_id, params)


@router.post("/{gig_id}/attachments", status_code=201, response_model=AttachmentOut)
async def upload_attachment(gig_id: str, request: Request, user_id: ObjectId = Depends(current_user_id)):
    """
    multipart/form-data with one "file" field. The form is read here, not as a parameter, so
    an oversized request is refused from its Content-Length before any of it is read.
    """
    length = request.headers.get("content-length")
    if length is None or not length.isdigit():
        raise AppError(411, "LENGTH_REQUIRED", "Send the file with its size (Content-Length).")
    if int(length) > MAX_FILE_BYTES + FORM_OVERHEAD_BYTES:
        raise AppError(413, "FILE_TOO_LARGE", "File is larger than 10 MB.")

    form = await request.form(max_files=1, max_fields=1)
    try:
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise field_error(400, "VALIDATION_FAILED", "file", "Choose a file to upload.")
        return await attachment_service.upload(user_id, gig_id, file)
    finally:
        await form.close()
