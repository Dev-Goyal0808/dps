"""FastAPI application factory and lifecycle wiring."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import encryption_demo, evaluation, health, messages, sessions
from app.config import Settings
from app.crypto.identity import IdentityKeyPair, TrustedPeerStore
from app.networking.tcp_server import TcpTransferServer
from app.services.encryption_demo import EncryptionDemoService
from app.services.result_store import ResultStore
from app.services.session_manager import SessionManager
from app.services.workflow_service import WorkflowService
from app.utils.errors import BackendError, ErrorCode


logger = logging.getLogger(__name__)


def _load_identity(settings: Settings) -> IdentityKeyPair:
    if settings.identity_private_key_path is not None:
        return IdentityKeyPair.load(settings.identity_private_key_path)
    return IdentityKeyPair.generate()


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or Settings.from_env()
    identity = _load_identity(resolved)
    configured_trust = TrustedPeerStore.from_b64(resolved.trusted_peer_keys)
    # A single-process demonstration uses one backend identity for both endpoints.
    trusted = configured_trust.add(identity.public_bytes)
    sessions_service = SessionManager(resolved, identity.fingerprint)
    encryption_demo_service = EncryptionDemoService(resolved, identity)
    results = ResultStore()
    workflow = WorkflowService(resolved, sessions_service, results, identity, trusted)
    server = TcpTransferServer(
        host=resolved.tcp_host,
        port=resolved.tcp_port,
        identity=identity,
        trusted_peers=trusted,
        max_frame_bytes=resolved.max_frame_bytes,
        max_image_bytes=resolved.max_stego_image_bytes,
        max_chunk_size=resolved.chunk_size,
        frame_timeout=resolved.frame_timeout_seconds,
        handshake_timeout=resolved.handshake_timeout_seconds,
        transfer_timeout=resolved.transfer_timeout_seconds,
        session_allowed=sessions_service.can_accept_transfer,
        on_transfer=workflow.handle_received,
    )
    workflow.set_server(server)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            server.start()
        except OSError:
            logger.error("TCP listener unavailable")
        try:
            yield
        finally:
            server.stop()
            workflow.shutdown()

    app = FastAPI(title="StegoCrypt Backend", version=resolved.app_version, lifespan=lifespan)
    app.state.settings = resolved
    app.state.identity = identity
    app.state.encryption_demo = encryption_demo_service
    app.state.sessions = sessions_service
    app.state.results = results
    app.state.workflow = workflow
    app.state.tcp_server = server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(BackendError)
    async def backend_error_handler(_: Request, exc: BackendError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": ErrorCode.INVALID_REQUEST,
                    "message": "The request is invalid.",
                    "details": {},
                }
            },
        )

    @app.exception_handler(Exception)
    async def internal_error_handler(_: Request, __: Exception) -> JSONResponse:
        logger.error("Unhandled backend error")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": ErrorCode.INTERNAL_ERROR,
                    "message": "The request could not be completed.",
                    "details": {},
                }
            },
        )

    app.include_router(health.router, prefix="/api")
    app.include_router(sessions.router, prefix="/api")
    app.include_router(messages.router, prefix="/api")
    app.include_router(evaluation.router, prefix="/api")
    app.include_router(encryption_demo.router, prefix="/api")
    return app


app = create_app()
