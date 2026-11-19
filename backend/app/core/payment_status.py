from decimal import Decimal

# A gig's payment status is never stored and never set by hand: it is worked out from the
# agreed amount and the sum of its payments (paidTotal). The same rule is written twice,
# once for Python (one gig) and once as a MongoDB filter (a list of gigs), side by side
# here so they can't drift apart.


def payment_status(agreed: Decimal, paid: Decimal) -> str:
    if paid <= 0:
        return "unpaid"
    if paid >= agreed:
        return "paid"
    return "partly_paid"


def payment_status_filter(status: str) -> dict:
    if status == "unpaid":
        return {"paidTotal": {"$lte": 0}}
    if status == "paid":
        return {"$expr": {"$gte": ["$paidTotal", "$agreedAmount"]}}
    return {"paidTotal": {"$gt": 0}, "$expr": {"$lt": ["$paidTotal", "$agreedAmount"]}}
