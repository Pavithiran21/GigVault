from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Annotated

from pydantic import BeforeValidator, PlainSerializer
from pydantic_core import PydanticCustomError

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
MAX_AMOUNT = Decimal("9999999999.99")

CURRENCIES = ("INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED")
CURRENCY_SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "AUD": "A$", "CAD": "C$", "SGD": "S$", "AED": "AED "}


def to_money(value) -> Decimal:
    """Any stored number (a Decimal, or 0 from an empty $sum) as a Decimal with exactly 2 places."""
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def format_money(value: Decimal) -> str:
    return str(to_money(value))


def parse_amount(value) -> Decimal:
    """
    Request amounts arrive as strings ("12500.00") or whole numbers. A JSON number with a
    fraction is refused: it may already have been rounded as a float by the sender.
    Messages match UI-UX.md.
    """
    if isinstance(value, bool) or isinstance(value, float):
        raise PydanticCustomError("amount_type", 'Send the amount as text, like "12500.00".')
    if isinstance(value, int):
        value = str(value)
    if not isinstance(value, str):
        raise PydanticCustomError("amount_type", 'Send the amount as text, like "12500.00".')

    try:
        amount = Decimal(value.strip())
    except InvalidOperation:
        raise PydanticCustomError("amount_invalid", "Enter an amount greater than 0.") from None

    if not amount.is_finite() or amount <= 0:
        raise PydanticCustomError("amount_not_positive", "Enter an amount greater than 0.")
    if amount.as_tuple().exponent < -2:
        raise PydanticCustomError("amount_decimals", "Use at most 2 decimal places.")
    if amount > MAX_AMOUNT:
        raise PydanticCustomError("amount_too_large", "Enter an amount below 10,000,000,000.")
    return amount.quantize(CENT)


# Request field: validated as above. Response field: always a string with 2 decimals,
# because a JSON number would become a float in the browser.
AmountIn = Annotated[Decimal, BeforeValidator(parse_amount)]
Money = Annotated[Decimal, PlainSerializer(format_money, return_type=str)]


def display_amount(value: Decimal, currency: str) -> str:
    """₹12,500.00 for messages. INR groups digits the Indian way (₹4,82,350.00)."""
    whole, cents = format_money(value).split(".")
    if currency == "INR" and len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        groups.insert(0, head)
        whole = ",".join(groups) + "," + tail
    else:
        whole = f"{int(whole):,}"
    return f"{CURRENCY_SYMBOLS.get(currency, '')}{whole}.{cents}"


def percent(part: Decimal, total: Decimal) -> Decimal:
    """part / total as a percentage with one decimal, rounded half up (29.4)."""
    if total == 0:
        return Decimal("0.0")
    return (Decimal(part) * 100 / Decimal(total)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
