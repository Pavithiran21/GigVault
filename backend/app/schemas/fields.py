import re
from typing import Annotated, Literal

from pydantic import AfterValidator
from pydantic_core import PydanticCustomError

from app.core.dates import known_time_zones
from app.core.money import CURRENCIES

# Field rules shared by the request schemas. Messages match UI-UX.md.

# The pattern browsers use for <input type="email">, with at least one dot in the domain.
EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)
RESET_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


def required_text(message: str, max_length: int):
    def check(value: str) -> str:
        value = value.strip()
        if not value:
            raise PydanticCustomError("blank", message)
        if len(value) > max_length:
            raise PydanticCustomError("too_long", f"Use at most {max_length} characters.")
        return value

    return AfterValidator(check)


def optional_text(max_length: int):
    # A blank optional field is stored as "not set" (None), not as "".
    def check(value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if len(value) > max_length:
            raise PydanticCustomError("too_long", f"Use at most {max_length} characters.")
        return value

    return AfterValidator(check)


def check_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not EMAIL_PATTERN.match(value):
        raise PydanticCustomError("email", "Enter a valid email, like name@example.com.")
    return value


def check_optional_email(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return check_email(value)


def check_new_password(value: str) -> str:
    if len(value) < 8 or not any(character.isdigit() for character in value):
        raise PydanticCustomError("password_weak", "Use at least 8 characters, with a number.")
    # bcrypt only uses the first 72 bytes, so longer passwords are refused rather than silently cut.
    if len(value.encode()) > 72:
        raise PydanticCustomError("password_long", "Use at most 72 characters.")
    return value


def check_current_password(value: str) -> str:
    if not value or len(value) > 200:
        raise PydanticCustomError("password_blank", "Enter your password.")
    return value


def check_currency(value: str) -> str:
    value = value.strip().upper()
    if value not in CURRENCIES:
        raise PydanticCustomError("currency", "Pick a currency from the list.")
    return value


def check_time_zone(value: str) -> str:
    if value not in known_time_zones():
        raise PydanticCustomError("time_zone", "Pick a time zone from the list.")
    return value


def check_reset_token(value: str) -> str:
    if not RESET_TOKEN_PATTERN.match(value):
        raise PydanticCustomError("reset_token", "This link is not valid.")
    return value


PersonName = Annotated[str, required_text("Enter your name.", 80)]
Email = Annotated[str, AfterValidator(check_email)]
OptionalEmail = Annotated[str | None, AfterValidator(check_optional_email)]
NewPassword = Annotated[str, AfterValidator(check_new_password)]
CurrentPassword = Annotated[str, AfterValidator(check_current_password)]
Currency = Annotated[str, AfterValidator(check_currency)]
TimeZone = Annotated[str, AfterValidator(check_time_zone)]
ResetToken = Annotated[str, AfterValidator(check_reset_token)]

ClientName = Annotated[str, required_text("Enter the client's name.", 120)]
GigTitle = Annotated[str, required_text("Enter a title for this gig.", 150)]
ShortText = Annotated[str | None, optional_text(120)]
Notes = Annotated[str | None, optional_text(2000)]

WorkStatus = Literal["pending", "in_progress", "delivered"]
PaymentStatus = Literal["unpaid", "partly_paid", "paid"]
PaymentMethod = Literal["bank_transfer", "upi", "card", "cash", "cheque", "paypal", "other"]
