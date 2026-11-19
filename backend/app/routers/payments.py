from datetime import date

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import current_user_id
from app.core.pagination import Page, PageParams
from app.schemas.payments import PaymentOut
from app.services import payment_service

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("", response_model=Page[PaymentOut])
async def list_payments(
    params: PageParams = Depends(),
    client_id: str | None = Query(None, alias="clientId", max_length=24),
    start: date | None = Query(None, alias="from"),
    end: date | None = Query(None, alias="to"),
    user_id: ObjectId = Depends(current_user_id),
):
    return await payment_service.list_all(user_id, params, client_id, start, end)


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(payment_id: str, user_id: ObjectId = Depends(current_user_id)):
    await payment_service.delete(user_id, payment_id)
    return Response(status_code=204)
