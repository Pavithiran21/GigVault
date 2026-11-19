from decimal import Decimal
from typing import Awaitable, Callable, TypeVar

from bson import ObjectId
from bson.codec_options import CodecOptions, TypeCodec, TypeRegistry
from bson.decimal128 import Decimal128
from bson.errors import InvalidId
from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import get_settings
from app.core.errors import not_found

T = TypeVar("T")


class DecimalCodec(TypeCodec):
    """
    Python Decimal <-> BSON Decimal128, so repositories and services only ever see Decimal.
    Decimal128 is MongoDB's exact decimal type: $sum and $add on it never drift like floats.
    """

    python_type = Decimal
    bson_type = Decimal128

    def transform_python(self, value: Decimal) -> Decimal128:
        return Decimal128(value)

    def transform_bson(self, value: Decimal128) -> Decimal:
        return value.to_decimal()


# tz_aware: datetimes come back as UTC-aware values, never naive ones.
CODEC_OPTIONS = CodecOptions(tz_aware=True, type_registry=TypeRegistry([DecimalCodec()]))

_client: AsyncMongoClient | None = None
_database: AsyncDatabase | None = None


async def connect() -> None:
    global _client, _database
    _client = AsyncMongoClient(get_settings().mongodb_uri, serverSelectionTimeoutMS=10000)
    # The database name is the path of MONGODB_URI (gigvault, gigvault_test or gigvault_demo).
    _database = _client.get_default_database(codec_options=CODEC_OPTIONS)
    await _client.admin.command("ping")


async def disconnect() -> None:
    global _client, _database
    if _client is not None:
        await _client.close()
    _client = None
    _database = None


def get_db() -> AsyncDatabase:
    if _database is None:
        raise RuntimeError("Database is not connected.")
    return _database


async def ping() -> bool:
    try:
        await get_db().command("ping")
        return True
    except Exception:
        return False


async def run_in_transaction(work: Callable[[AsyncClientSession], Awaitable[T]]) -> T:
    """
    Runs work(session) in one MongoDB transaction: every write in it is kept, or none is.
    with_transaction retries the whole function on a transient error such as a write conflict
    (two requests changing the same gig at once), so work must only use the database.
    """
    if _client is None:
        raise RuntimeError("Database is not connected.")
    async with _client.start_session() as session:
        return await session.with_transaction(work)


def parse_object_id(value: str, what: str) -> ObjectId:
    # An id that isn't even a valid ObjectId can't exist, so it is simply not found.
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise not_found(what) from None


async def ensure_indexes() -> None:
    """Creates every index the queries rely on. Safe to run on every start (create_index is idempotent)."""
    db = get_db()

    await db.users.create_index("email", unique=True)

    # TTL indexes: MongoDB removes expired tokens by itself, so no clean-up job is needed.
    for collection in (db.refresh_tokens, db.password_reset_tokens):
        await collection.create_index("tokenHash", unique=True)
        await collection.create_index("userId")
        await collection.create_index("expiresAt", expireAfterSeconds=0)

    await db.clients.create_index([("userId", ASCENDING), ("name", ASCENDING)])
    await db.gigs.create_index([("userId", ASCENDING), ("startDate", DESCENDING)])
    await db.gigs.create_index([("userId", ASCENDING), ("clientId", ASCENDING)])
    await db.payments.create_index([("userId", ASCENDING), ("receivedOn", DESCENDING)])
    await db.payments.create_index([("gigId", ASCENDING), ("receivedOn", DESCENDING)])
    await db.payments.create_index([("userId", ASCENDING), ("clientId", ASCENDING)])
    await db.attachments.create_index([("gigId", ASCENDING), ("createdAt", DESCENDING)])
    await db.attachments.create_index("userId")
