from datetime import datetime

from app.schemas.common import ApiModel


class AttachmentOut(ApiModel):
    id: str
    gig_id: str
    file_name: str
    content_type: str
    size: int
    created_at: datetime
    download_url: str

    @classmethod
    def from_doc(cls, attachment: dict) -> "AttachmentOut":
        attachment_id = str(attachment["_id"])
        return cls(
            id=attachment_id,
            gig_id=str(attachment["gigId"]),
            file_name=attachment["fileName"],
            content_type=attachment["contentType"],
            size=attachment["size"],
            created_at=attachment["createdAt"],
            download_url=f"/api/attachments/{attachment_id}/download",
        )
