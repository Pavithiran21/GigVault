from bson import ObjectId

from app.core.errors import AppError, field_error
from app.core.security import hash_password, password_matches
from app.repositories import (
    attachment_repository,
    client_repository,
    gig_repository,
    payment_repository,
    token_repository,
    user_repository,
)
from app.schemas.auth import ChangePasswordIn, ProfileUpdateIn
from app.services.auth_service import Session, create_session


def account_gone() -> AppError:
    # The access token can outlive a deleted account by a few minutes; treat that as logged out.
    return AppError(401, "UNAUTHENTICATED", "Please log in.")


def ensure_not_demo(user: dict) -> None:
    if user.get("isDemo"):
        raise AppError(403, "DEMO_ACCOUNT_LOCKED", "Demo accounts cannot change their password or be deleted.")


async def verify_password(user: dict, password: str, field: str) -> None:
    # A wrong password here is a form error (400), not 401: the frontend logs the user out on
    # any 401, and a typo must not end their session.
    if not await password_matches(password, user["passwordHash"]):
        raise field_error(400, "WRONG_PASSWORD", field, "That password isn't right.")


async def get_profile(user_id: ObjectId) -> dict:
    user = await user_repository.find_by_id(user_id)
    if user is None:
        raise account_gone()
    return user


async def update_profile(user_id: ObjectId, data: ProfileUpdateIn) -> dict:
    # Changing the currency only relabels amounts; nothing is converted.
    changes = {}
    if data.name is not None:
        changes["name"] = data.name
    if data.default_currency is not None:
        changes["defaultCurrency"] = data.default_currency
    if data.time_zone is not None:
        changes["timeZone"] = data.time_zone

    user = await user_repository.update_profile(user_id, changes)
    if user is None:
        raise account_gone()
    return user


async def change_password(user_id: ObjectId, data: ChangePasswordIn) -> tuple[dict, Session]:
    """Changes the password, signs out every other session and returns a new session for this one."""
    user = await get_profile(user_id)
    ensure_not_demo(user)
    await verify_password(user, data.current_password, "currentPassword")

    await user_repository.update_password_hash(user_id, await hash_password(data.new_password))
    await token_repository.delete_all_refresh_tokens(user_id)
    return user, await create_session(user_id)


async def delete_account(user_id: ObjectId, password: str) -> None:
    """Permanently removes the user, their clients, gigs, payments and uploaded files."""
    user = await get_profile(user_id)
    ensure_not_demo(user)
    await verify_password(user, password, "password")

    # Files are stored inside the attachment documents, so deleting those deletes the files.
    # The user record goes last.
    await attachment_repository.delete_all_for_user(user_id)
    await payment_repository.delete_all_for_user(user_id)
    await gig_repository.delete_all_for_user(user_id)
    await client_repository.delete_all_for_user(user_id)
    await token_repository.delete_all_reset_tokens(user_id)
    await user_repository.delete(user_id)
    await token_repository.delete_all_refresh_tokens(user_id)
