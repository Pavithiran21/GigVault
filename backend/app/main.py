import logging
import re
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core import database
from app.core.config import get_settings
from app.core.errors import error_response, register_error_handlers
from app.core.frontend import serve_frontend
from app.routers import attachments, auth, clients, dashboard, demo, exports, gigs, health, payments, profile

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("gigvault")

REQUEST_ID_PATTERN = re.compile(r"^[\w-]{1,64}$")
MAX_JSON_BODY_BYTES = 16 * 1024


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await database.connect()
    await database.ensure_indexes()
    logger.info("GigVault API ready on database %s", database.get_db().name)
    yield
    await database.disconnect()


def _is_upload(request: Request) -> bool:
    return request.method == "POST" and request.url.path.endswith("/attachments")


async def request_context(request: Request, call_next):
    """
    Request id, body size limit, security headers and one log line per request. Only the
    method, path and status are logged: no headers, IPs, bodies or query strings (a search
    such as ?q=<client name> can be personal).
    """
    incoming = request.headers.get("x-request-id", "")
    request.state.request_id = incoming if REQUEST_ID_PATTERN.match(incoming) else str(uuid.uuid4())
    started = time.perf_counter()

    length = request.headers.get("content-length", "")
    if not _is_upload(request) and length.isdigit() and int(length) > MAX_JSON_BODY_BYTES:
        response = error_response(request, 413, "PAYLOAD_TOO_LARGE", "The request body is too large.")
    else:
        try:
            response = await call_next(request)
        except Exception:
            # No stack trace or personal data in the body; the log has the details.
            logger.exception("Unhandled error id=%s", request.state.request_id)
            response = error_response(request, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.")

    response.headers["X-Request-Id"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path != "/api/health":
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("%s %s %d %.0fms id=%s", request.method, request.url.path, response.status_code, elapsed_ms, request.state.request_id)
    return response


def create_app() -> FastAPI:
    # The interactive API docs exist only outside production.
    docs_url = None if settings.is_production else "/api/docs"
    app = FastAPI(title="GigVault API", version="1.0.0", lifespan=lifespan, docs_url=docs_url, redoc_url=None, openapi_url="/api/openapi.json" if docs_url else None)

    # Added first, so it runs inside CORS: error responses from it still get CORS headers.
    app.add_middleware(BaseHTTPMiddleware, dispatch=request_context)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
        expose_headers=["X-Request-Id", "Content-Disposition", "X-Row-Count"],
    )
    register_error_handlers(app)

    for module in (health, auth, profile, clients, gigs, payments, attachments, dashboard, exports, demo):
        app.include_router(module.router)
    if settings.static_dir:
        serve_frontend(app, settings.static_dir)
    return app


app = create_app()
