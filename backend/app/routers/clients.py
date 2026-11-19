from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import current_user_id
from app.core.pagination import Page, PageParams
from app.schemas.clients import ClientIn, ClientOut
from app.services import client_service

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("", response_model=Page[ClientOut])
async def list_clients(
    params: PageParams = Depends(),
    q: str | None = Query(None, max_length=100),
    user_id: ObjectId = Depends(current_user_id),
):
    return await client_service.list_page(user_id, params, q)


@router.post("", status_code=201, response_model=ClientOut)
async def create_client(data: ClientIn, user_id: ObjectId = Depends(current_user_id)):
    return await client_service.create(user_id, data)


@router.get("/{client_id}", response_model=ClientOut)
async def get_client(client_id: str, user_id: ObjectId = Depends(current_user_id)):
    return await client_service.get(user_id, client_id)


@router.put("/{client_id}", response_model=ClientOut)
async def update_client(client_id: str, data: ClientIn, user_id: ObjectId = Depends(current_user_id)):
    return await client_service.update(user_id, client_id, data)


@router.delete("/{client_id}", status_code=204)
async def delete_client(client_id: str, user_id: ObjectId = Depends(current_user_id)):
    await client_service.delete(user_id, client_id)
    return Response(status_code=204)
