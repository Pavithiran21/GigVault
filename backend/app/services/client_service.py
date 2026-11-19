from bson import ObjectId

from app.core.database import parse_object_id
from app.core.errors import AppError, not_found
from app.core.money import to_money
from app.core.pagination import PageParams, parse_sort, to_page
from app.repositories import client_repository, gig_repository, payment_repository
from app.schemas.clients import ClientIn, ClientOut

CLIENT_SORT_FIELDS = ["name", "createdAt"]


def _fields(data: ClientIn) -> dict:
    return {
        "name": data.name,
        "contactName": data.contact_name,
        "contactEmail": data.contact_email,
        "notes": data.notes,
    }


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


async def _with_totals(user_id: ObjectId, clients: list[dict]) -> list[ClientOut]:
    """Adds each client's gig count, payment count and owed amount (two grouped queries for the whole page)."""
    client_ids = [client["_id"] for client in clients]
    gig_totals = await gig_repository.totals_by_client(user_id, client_ids)
    payment_counts = await payment_repository.counts_by_client(user_id, client_ids)

    result = []
    for client in clients:
        totals = gig_totals.get(client["_id"], {})
        result.append(
            ClientOut.from_doc(
                client,
                gig_count=totals.get("gigCount", 0),
                payment_count=payment_counts.get(client["_id"], 0),
                owed=to_money(totals.get("owed", 0)),
            )
        )
    return result


async def _find_or_404(user_id: ObjectId, client_id: str) -> dict:
    client = await client_repository.find(user_id, parse_object_id(client_id, "Client"))
    if client is None:
        raise not_found("Client")
    return client


async def create(user_id: ObjectId, data: ClientIn) -> ClientOut:
    client = await client_repository.create(user_id, _fields(data))
    return (await _with_totals(user_id, [client]))[0]


async def get(user_id: ObjectId, client_id: str) -> ClientOut:
    client = await _find_or_404(user_id, client_id)
    return (await _with_totals(user_id, [client]))[0]


async def list_page(user_id: ObjectId, params: PageParams, search: str | None) -> dict:
    sort = parse_sort(params.sort, CLIENT_SORT_FIELDS, "name")
    clients, total = await client_repository.list_page(user_id, search, sort, params.skip, params.size)
    return to_page(await _with_totals(user_id, clients), total, params)


async def update(user_id: ObjectId, client_id: str, data: ClientIn) -> ClientOut:
    client = await client_repository.update(user_id, parse_object_id(client_id, "Client"), _fields(data))
    if client is None:
        raise not_found("Client")
    return (await _with_totals(user_id, [client]))[0]


async def delete(user_id: ObjectId, client_id: str) -> None:
    client = await _find_or_404(user_id, client_id)

    # A client with gigs can't be deleted: its gigs and payments would lose their client.
    gig_count = await gig_repository.count_for_client(user_id, client["_id"])
    if gig_count > 0:
        payment_count = (await payment_repository.counts_by_client(user_id, [client["_id"]])).get(client["_id"], 0)
        message = (
            f"Can't delete {client['name']} yet: this client has {_plural(gig_count, 'gig')} "
            f"and {_plural(payment_count, 'payment')}. Delete or move them first."
        )
        raise AppError(409, "CLIENT_IN_USE", message)

    await client_repository.delete(user_id, client["_id"])
