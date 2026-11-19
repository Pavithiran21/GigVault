from datetime import datetime

from pydantic import model_validator
from pydantic_core import PydanticCustomError

from app.schemas.common import ApiModel
from app.schemas.fields import CurrentPassword, Currency, Email, NewPassword, PersonName, ResetToken, TimeZone


class RegisterIn(ApiModel):
    name: PersonName
    email: Email
    password: NewPassword
    default_currency: Currency = "INR"
    # Sent by the browser (Intl.DateTimeFormat().resolvedOptions().timeZone); decides what "today" is.
    time_zone: TimeZone = "Asia/Kolkata"


class LoginIn(ApiModel):
    email: Email
    password: CurrentPassword


class ForgotPasswordIn(ApiModel):
    email: Email


class ResetPasswordIn(ApiModel):
    token: ResetToken
    password: NewPassword


class UserOut(ApiModel):
    id: str
    name: str
    email: str
    default_currency: str
    time_zone: str
    is_demo: bool
    created_at: datetime

    @classmethod
    def from_doc(cls, user: dict) -> "UserOut":
        return cls(
            id=str(user["_id"]),
            name=user["name"],
            email=user["email"],
            default_currency=user["defaultCurrency"],
            time_zone=user["timeZone"],
            is_demo=user.get("isDemo", False),
            created_at=user["createdAt"],
        )


class AuthOut(ApiModel):
    """The access token goes in the body; the refresh token only in the HTTP-only cookie."""

    user: UserOut
    access_token: str


class MessageOut(ApiModel):
    message: str


class ProfileUpdateIn(ApiModel):
    # Unknown keys (for example "email") are ignored, so only these can change.
    name: PersonName | None = None
    default_currency: Currency | None = None
    time_zone: TimeZone | None = None

    @model_validator(mode="after")
    def something_to_change(self):
        if self.name is None and self.default_currency is None and self.time_zone is None:
            raise PydanticCustomError("nothing_to_change", "Change your name, currency or time zone.")
        return self


class ChangePasswordIn(ApiModel):
    current_password: CurrentPassword
    new_password: NewPassword


class DeleteAccountIn(ApiModel):
    password: CurrentPassword
