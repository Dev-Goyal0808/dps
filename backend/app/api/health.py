"""Backend health endpoint."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse


router = APIRouter()


@router.get("/health")
def health(request: Request) -> JSONResponse:
    settings = request.app.state.settings
    server = request.app.state.tcp_server
    ready = bool(server.is_ready)
    body = {
        "status": "ok" if ready else "unavailable",
        "version": settings.app_version,
        "tcp_listener": "ready" if ready else "unavailable",
    }
    return JSONResponse(body, status_code=200 if ready else 503)
