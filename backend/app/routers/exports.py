from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import current_user_id
from app.routers.gigs import gig_filters
from app.services import export_service
from app.services.gig_service import GigFilters

router = APIRouter(prefix="/api/exports", tags=["exports"])


@router.get("/gigs.csv")
async def export_gigs(
    filters: GigFilters = Depends(gig_filters),
    sort: str | None = Query(None, max_length=50),
    user_id: ObjectId = Depends(current_user_id),
):
    file_name, content, row_count = await export_service.gigs_csv(user_id, filters, sort)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            # For the "CSV ready: 23 gigs" toast.
            "X-Row-Count": str(row_count),
            "Cache-Control": "private, no-store",
        },
    )
