import os
import time
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Any, Dict, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field

SERVICE_START_TIME = time.time()


class UptimeResponse(BaseModel):
    start_time: float = Field(..., description="Unix epoch when the service started.")
    uptime_seconds: float = Field(..., description="Elapsed seconds since service start.")
    upstream_uptime_seconds: Optional[float] = Field(
        None,
        description="Latest observed uptime (seconds) reported by the upstream MCP status service.",
    )
    generated_at: float = Field(..., description="Unix epoch when this payload was generated.")


class DependencyStatus(BaseModel):
    status: str
    latencyMs: float
    checkedAt: str
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class StatusEnvelope(BaseModel):
    service: Dict[str, Any]
    system: Dict[str, Any]
    sessions: Dict[str, Any]
    tools: Dict[str, Any]
    dependencies: Dict[str, DependencyStatus] = Field(default_factory=dict)
    generatedAt: str


@lru_cache(maxsize=1)
def get_status_base_url() -> str:
    base_url = os.getenv("STATUS_SERVICE_BASE_URL", "http://127.0.0.1:8090")
    return base_url.rstrip("/")


@lru_cache(maxsize=1)
def get_status_api_key() -> Optional[str]:
    token = os.getenv("STATUS_SERVICE_API_KEY")
    return token.strip() if token else None


@lru_cache(maxsize=1)
def get_status_timeout() -> float:
    raw = os.getenv("STATUS_SERVICE_TIMEOUT", "5.0")
    try:
        timeout = float(raw)
    except ValueError:
        timeout = 5.0
    return max(timeout, 0.1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout = get_status_timeout()
    app.state.http_client = httpx.AsyncClient(timeout=timeout)
    if os.getenv("STATUS_SERVICE_WARMUP", "1").lower() not in {"0", "false"}:
        try:
            await _fetch_status(app, refresh=True)
        except Exception as exc:  # noqa: BLE001
            print(f"[fastapi-status] warmup failed: {exc}")
    try:
        yield
    finally:
        await app.state.http_client.aclose()


def build_application() -> FastAPI:
    return FastAPI(
        title="MCP CryptoWallet Observability API",
        version=os.getenv("FASTAPI_LAYER_VERSION", "1.0.0"),
        description=(
            "Operational companion service for the MCP CryptoWallet EVM server. "
            "Provides REST endpoints with OpenAPI/Swagger support for health, status, "
            "and uptime inspection."
        ),
        lifespan=lifespan,
    )


app = build_application()


async def _fetch_status(app: FastAPI, refresh: bool = False) -> Dict[str, Any]:
    endpoint = "/status"
    params = {"refresh": "1"} if refresh else None
    url = f"{get_status_base_url()}{endpoint}"
    headers = {}
    api_key = get_status_api_key()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    response = await app.state.http_client.get(url, params=params, headers=headers)
    if response.status_code >= 500:
        raise HTTPException(status_code=502, detail="Upstream status service error")
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


async def _fetch_health(app: FastAPI) -> str:
    url = f"{get_status_base_url()}/health"
    headers = {}
    api_key = get_status_api_key()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    response = await app.state.http_client.get(url, headers=headers)
    if response.status_code >= 500:
        raise HTTPException(status_code=502, detail="Upstream status service error")
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.text


async def get_status_payload(
    request: Request,
    refresh: bool = Query(default=False, description="Force dependency refresh on upstream status server."),
) -> StatusEnvelope:
    data = await _fetch_status(request.app, refresh=refresh)
    return StatusEnvelope(**data)


@app.get("/health", response_class=PlainTextResponse, summary="Service health check")
async def health(request: Request) -> PlainTextResponse:
    await _fetch_health(request.app)
    return PlainTextResponse("ok")


@app.get(
    "/status",
    response_model=StatusEnvelope,
    summary="Full status payload from the MCP status server",
)
async def status(
    snapshot: StatusEnvelope = Depends(get_status_payload),
) -> JSONResponse:
    return JSONResponse(snapshot.model_dump(mode="json"))


@app.get(
    "/status/dependencies",
    response_model=Dict[str, DependencyStatus],
    summary="Dependency probe details",
)
async def dependency_status(
    snapshot: StatusEnvelope = Depends(get_status_payload),
) -> Dict[str, DependencyStatus]:
    return snapshot.dependencies


@app.get("/uptime", response_model=UptimeResponse, summary="Uptime information")
async def uptime(request: Request) -> UptimeResponse:
    upstream_url = f"{get_status_base_url()}/uptime"
    headers = {}
    api_key = get_status_api_key()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    upstream_uptime = None
    try:
        response = await request.app.state.http_client.get(upstream_url, headers=headers)
        response.raise_for_status()
        payload = response.json()
        upstream_uptime = float(payload.get("uptimeSeconds", 0.0))
    except httpx.HTTPError:
        upstream_uptime = None

    now = time.time()
    return UptimeResponse(
        start_time=SERVICE_START_TIME,
        uptime_seconds=now - SERVICE_START_TIME,
        upstream_uptime_seconds=upstream_uptime,
        generated_at=now,
    )
