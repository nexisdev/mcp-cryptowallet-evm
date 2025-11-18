import json
import os
import time
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set, Union

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field, ValidationError
from typing_extensions import Literal

SERVICE_START_TIME = time.time()
NATIVE_TOKEN_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"


# ---------------------------------------------------------------------------
# Status schemas
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Thirdweb configuration helpers
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_thirdweb_api_base() -> str:
    return (os.getenv("THIRDWEB_API_BASE_URL", "https://api.thirdweb.com") or "https://api.thirdweb.com").rstrip("/")


@lru_cache(maxsize=1)
def get_thirdweb_client_id() -> Optional[str]:
    value = os.getenv("THIRDWEB_CLIENT_ID")
    if value:
        trimmed = value.strip()
        if trimmed:
            return trimmed
    return None


@lru_cache(maxsize=1)
def get_thirdweb_secret_key() -> Optional[str]:
    value = os.getenv("THIRDWEB_SECRET_KEY")
    if value:
        trimmed = value.strip()
        if trimmed:
            return trimmed
    return None


# ---------------------------------------------------------------------------
# API key / authentication models
# ---------------------------------------------------------------------------


class ApiKeyDefinition(BaseModel):
    key: str
    tier: Literal["free", "paid"]
    scopes: Set[str] = Field(default_factory=set)
    userId: Optional[str] = None
    organizationId: Optional[str] = None
    label: Optional[str] = None
    limits: Dict[str, Any] = Field(default_factory=dict)


@lru_cache(maxsize=1)
def load_api_key_config() -> Dict[str, ApiKeyDefinition]:
    raw = os.getenv("FASTAPI_API_KEYS")
    if not raw:
        return {}

    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            raise ValueError("FASTAPI_API_KEYS must be a JSON array.")
        parsed: Dict[str, ApiKeyDefinition] = {}
        for entry in data:
            definition = ApiKeyDefinition.parse_obj(entry)
            parsed[definition.key] = definition
        return parsed
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        raise RuntimeError(f"Invalid FASTAPI_API_KEYS value: {exc}") from exc


class AuthContext(BaseModel):
    apiKey: ApiKeyDefinition
    tier: Literal["free", "paid"]
    scopes: Set[str]
    authToken: Optional[str] = None
    agentId: Optional[str] = None
    sessionId: Optional[str] = None
    walletProvider: Optional[str] = None


def _normalize_scope_set(values: Set[str]) -> Set[str]:
    return {value.strip() for value in values if value.strip()}


def get_auth_context(request: Request) -> AuthContext:
    api_keys = load_api_key_config()
    api_key_header = request.headers.get("x-api-key")
    if not api_key_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="X-API-Key header required.")

    api_key = api_keys.get(api_key_header)
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key.")

    requested_tier = request.headers.get("x-nex-tier", api_key.tier).lower()
    if requested_tier not in {"free", "paid"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Nex-Tier header.")

    if requested_tier != api_key.tier:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"API key tier mismatch. Expected '{api_key.tier}', received '{requested_tier}'.",
        )

    auth_header = request.headers.get("authorization")
    bearer_token: Optional[str] = None
    if auth_header:
        trimmed = auth_header.strip()
        if trimmed.lower().startswith("bearer "):
            bearer_token = trimmed[7:].strip()
        else:
            bearer_token = trimmed

    scopes_header = request.headers.get("x-nex-required-scopes")
    scopes: Set[str] = set(api_key.scopes)
    if scopes_header:
        header_scopes = {scope.strip() for scope in scopes_header.split(",") if scope.strip()}
        scopes |= header_scopes

    return AuthContext(
        apiKey=api_key,
        tier=api_key.tier,
        scopes=_normalize_scope_set(scopes),
        authToken=bearer_token,
        agentId=request.headers.get("x-nex-agent-id"),
        sessionId=request.headers.get("x-nex-session-id"),
        walletProvider=request.headers.get("x-nex-wallet-provider"),
    )


def require_scope(auth: AuthContext, scope: str) -> None:
    if scope not in auth.scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation requires scope '{scope}'.",
        )


def require_paid_tier(auth: AuthContext, feature: str) -> None:
    if auth.tier == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{feature} is unavailable on the free tier.",
        )


# ---------------------------------------------------------------------------
# Transaction intent schemas
# ---------------------------------------------------------------------------


class ChainIdentifier(BaseModel):
    chainId: int
    network: str
    layer: Literal["L1", "L2", "alt"]


class AutomatedMode(BaseModel):
    kind: Literal["automated"]
    agentId: str = Field(..., alias="agentId")
    auditTrailId: Optional[str] = None


class ManualMode(BaseModel):
    kind: Literal["manual"]
    approverUserId: str
    approvalId: str


TransactionMode = Union[AutomatedMode, ManualMode]


class SignatureIntent(BaseModel):
    type: Literal["signMessage", "signTypedData"]
    payload: Union[str, Dict[str, Any]]


class ApprovalMetadata(BaseModel):
    spender: str
    token: str
    amount: str


class TransferTarget(BaseModel):
    address: str
    amount: str


class TransferMetadata(BaseModel):
    type: Literal["native", "erc20"]
    amount: str
    tokenAddress: Optional[str] = None
    to: List[TransferTarget]


class BridgeMetadata(BaseModel):
    destinationChainId: int
    destinationAddress: str
    router: Optional[Literal["wormhole", "relay", "celer", "layerzero"]] = None
    slippageBps: Optional[int] = Field(None, ge=0, le=10_000)
    minAmountWei: Optional[str] = None


class SwapMetadata(BaseModel):
    protocol: Optional[Literal["uniswap", "pancakeswap", "jupiter"]] = None
    tokenIn: str
    tokenOut: str
    amountIn: Optional[str] = None
    minAmountOut: Optional[str] = None
    slippageBps: Optional[int] = Field(None, ge=0, le=10_000)


class TransactionIntent(BaseModel):
    id: str
    provider: Literal["thirdweb_embedded", "thirdweb_server", "thirdweb_in_app", "walletconnect_external"]
    chain: ChainIdentifier
    fromAddress: str
    mode: TransactionMode
    kind: Literal["sign_message", "sign_typed_data", "approve_erc20", "send_native", "send_token", "bridge", "swap"]
    signature: Optional[SignatureIntent] = None
    approval: Optional[ApprovalMetadata] = None
    transfer: Optional[TransferMetadata] = None
    bridge: Optional[BridgeMetadata] = None
    swap: Optional[SwapMetadata] = None
    metadata: Optional[Dict[str, Any]] = None


class TransactionExecutionResult(BaseModel):
    intentId: str
    provider: str
    state: Literal["pending", "submitted", "confirmed", "failed"]
    transactionHash: Optional[str] = None
    approvalHash: Optional[str] = None
    swapHash: Optional[str] = None
    bridgeTraceId: Optional[str] = None
    diagnostics: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------


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
        title="MCP CryptoWallet API",
        version=os.getenv("FASTAPI_LAYER_VERSION", "1.0.0"),
        description=(
            "Operational companion service for the MCP CryptoWallet EVM server. "
            "Provides REST endpoints for health, status, uptime, and transaction execution."
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
async def status_endpoint(
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


# ---------------------------------------------------------------------------
# Thirdweb execution helpers
# ---------------------------------------------------------------------------


def _thirdweb_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    client_id = get_thirdweb_client_id()
    secret_key = get_thirdweb_secret_key()

    if client_id:
        headers["x-client-id"] = client_id
    if secret_key:
        headers["x-secret-key"] = secret_key

    if "x-client-id" not in headers and "x-secret-key" not in headers:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Thirdweb credentials are not configured. Set THIRDWEB_SECRET_KEY or THIRDWEB_CLIENT_ID.",
        )

    return headers


async def _post_thirdweb(app: FastAPI, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{get_thirdweb_api_base()}{path}"
    headers = _thirdweb_headers()

    try:
        response = await app.state.http_client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to reach thirdweb API: {exc}",
        ) from exc

    if response.status_code >= 500:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Thirdweb API returned an upstream error.",
        )

    if response.status_code >= 400:
        detail_text = response.text or "Thirdweb request rejected."
        raise HTTPException(status_code=response.status_code, detail=detail_text)

    return response.json()


async def _execute_bridge(request: Request, intent: TransactionIntent) -> TransactionExecutionResult:
    if not intent.transfer or not intent.bridge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bridge intents require transfer and bridge metadata.",
        )

    transfer = intent.transfer
    bridge = intent.bridge
    destination_address = bridge.destinationAddress or intent.fromAddress
    token_address = transfer.tokenAddress or NATIVE_TOKEN_SENTINEL
    amount_wei = transfer.amount

    payload: Dict[str, Any] = {
        "from": intent.fromAddress,
        "exact": "input",
        "tokenIn": {
            "address": token_address,
            "chainId": intent.chain.chainId,
            "amount": amount_wei,
        },
        "tokenOut": {
            "address": token_address,
            "chainId": bridge.destinationChainId,
            "minAmount": bridge.minAmountWei,
        },
        "slippageToleranceBps": bridge.slippageBps,
        "metadata": {
            "destinationAddress": destination_address,
            "router": bridge.router,
            "intentId": intent.id,
            "provider": intent.provider,
            **(intent.metadata or {}),
        },
    }

    result = await _post_thirdweb(request.app, "/v1/bridge/swap", payload)
    transaction_id = result.get("result", {}).get("transactionId")

    return TransactionExecutionResult(
        intentId=intent.id,
        provider=intent.provider,
        state="submitted",
        bridgeTraceId=transaction_id,
        diagnostics={"thirdweb": result},
    )


async def _execute_swap(request: Request, intent: TransactionIntent) -> TransactionExecutionResult:
    if not intent.swap:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Swap intents require swap metadata.")

    swap = intent.swap
    amount_in = swap.amountIn or (intent.transfer.amount if intent.transfer else None)
    if amount_in is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Swap amount is required.")

    payload: Dict[str, Any] = {
        "from": intent.fromAddress,
        "exact": "input",
        "tokenIn": {
            "address": swap.tokenIn,
            "chainId": intent.chain.chainId,
            "amount": amount_in,
        },
        "tokenOut": {
            "address": swap.tokenOut,
            "chainId": intent.chain.chainId,
            "minAmount": swap.minAmountOut,
        },
        "slippageToleranceBps": swap.slippageBps,
        "metadata": {
            "protocol": swap.protocol,
            "intentId": intent.id,
            "provider": intent.provider,
            **(intent.metadata or {}),
        },
    }

    result = await _post_thirdweb(request.app, "/v1/bridge/swap", payload)
    transaction_id = result.get("result", {}).get("transactionId")

    return TransactionExecutionResult(
        intentId=intent.id,
        provider=intent.provider,
        state="submitted",
        swapHash=transaction_id,
        diagnostics={"thirdweb": result},
    )


# ---------------------------------------------------------------------------
# Transaction endpoint
# ---------------------------------------------------------------------------


@app.post(
    "/wallets/intents",
    response_model=TransactionExecutionResult,
    summary="Execute a wallet transaction intent",
    status_code=status.HTTP_200_OK,
)
async def execute_transaction_intent(
    intent: TransactionIntent,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
) -> TransactionExecutionResult:
    if intent.kind == "bridge":
        require_scope(auth, "wallet:bridge")
        require_paid_tier(auth, "Cross-chain bridge execution")
        return await _execute_bridge(request, intent)
    if intent.kind == "swap":
        require_scope(auth, "wallet:swap")
        require_paid_tier(auth, "Token swap execution")
        return await _execute_swap(request, intent)

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"Transaction kind '{intent.kind}' is not supported by this service.",
    )
