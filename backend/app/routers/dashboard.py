from datetime import date
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, Query

from app.core.auth import current_user_id
from app.schemas.dashboard import DashboardOut
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
async def get_dashboard(
    period: Literal["month", "year", "custom"] = Query("year"),
    start: date | None = Query(None, alias="from"),
    end: date | None = Query(None, alias="to"),
    user_id: ObjectId = Depends(current_user_id),
):
    """month and year are the current ones in the user's time zone; custom needs from and to."""
    return await dashboard_service.get_dashboard(user_id, period, start, end)
