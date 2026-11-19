from fastapi import Request
from limits import RateLimitItem, RateLimitItemPerHour, RateLimitItemPerMinute
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter

from app.core.config import get_settings
from app.core.errors import AppError

# The same limits as WeatherPing. Counters live in memory, which is fine for one backend
# process. RATE_LIMITS_ENABLED=false (Playwright's main pass only) turns every limit off.
LOGIN_PER_IP = RateLimitItemPerMinute(20, 15)
LOGIN_FAILURES_PER_ACCOUNT = RateLimitItemPerMinute(5, 15)
REGISTER_PER_IP = RateLimitItemPerHour(10)
FORGOT_PASSWORD_PER_IP = RateLimitItemPerMinute(5, 15)
RESET_PASSWORD_PER_IP = RateLimitItemPerMinute(10, 15)

_limiter = FixedWindowRateLimiter(MemoryStorage())


def too_many_attempts() -> AppError:
    return AppError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.")


def _enabled() -> bool:
    return get_settings().rate_limits_enabled


def per_ip(item: RateLimitItem, name: str):
    """A route dependency: counts every request from one IP address and refuses it over the limit."""

    def check(request: Request) -> None:
        if not _enabled():
            return
        address = request.client.host if request.client else "unknown"
        if not _limiter.hit(item, name, address):
            raise too_many_attempts()

    return check


def ensure_login_allowed(email: str) -> None:
    """Refuses a login when this account already has 5 failed tries in 15 minutes, from any IP."""
    if _enabled() and not _limiter.test(LOGIN_FAILURES_PER_ACCOUNT, "login-account", email):
        raise too_many_attempts()


def record_failed_login(email: str) -> None:
    # Only failures count, so a user who logs in correctly is never locked out by their own logins.
    if _enabled():
        _limiter.hit(LOGIN_FAILURES_PER_ACCOUNT, "login-account", email)
