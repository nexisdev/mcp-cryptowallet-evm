import { UserError } from "fastmcp";

const getBaseUrl = (): string => {
  return (process.env.THIRDWEB_API_BASE_URL ?? "https://api.thirdweb.com").replace(/\/$/, "");
};

const getClientId = (): string | undefined => {
  const value = process.env.THIRDWEB_CLIENT_ID;
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

const getSecretKey = (): string | undefined => {
  const value = process.env.THIRDWEB_SECRET_KEY;
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

type BridgeSwapRequest = {
  from: string;
  tokenIn: {
    address: string;
    chainId: number;
    amount?: string;
    maxAmount?: string;
  };
  tokenOut: {
    address: string;
    chainId: number;
    amount?: string;
    minAmount?: string;
  };
  exact?: "input" | "output";
  slippageToleranceBps?: number | null;
  metadata?: Record<string, unknown>;
};

type BridgeSwapResponse = {
  result: {
    transactionId: string;
    steps?: Array<Record<string, unknown>>;
  };
};

type ThirdwebHeaders = Record<string, string>;

const resolveAuthHeaders = (): ThirdwebHeaders => {
  const clientId = getClientId();
  const secretKey = getSecretKey();

  if (!secretKey && !clientId) {
    throw new UserError(
      "Thirdweb authentication is not configured. Set THIRDWEB_SECRET_KEY or THIRDWEB_CLIENT_ID.",
    );
  }

  const headers: ThirdwebHeaders = {
    "Content-Type": "application/json",
  };

  if (clientId) {
    headers["x-client-id"] = clientId;
  }
  if (secretKey) {
    headers["x-secret-key"] = secretKey;
  }

  return headers;
};

const assertFetch = (): typeof fetch => {
  if (typeof fetch !== "function") {
    throw new UserError("Global fetch API is unavailable in this runtime.");
  }
  return fetch;
};

const postJson = async <TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> => {
  const authHeaders = resolveAuthHeaders();
  const fetchImpl = assertFetch();
  const url = `${getBaseUrl()}${path}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new UserError(
      `Thirdweb API request failed with status ${response.status}: ${errorBody || response.statusText}`,
    );
  }

  return (await response.json()) as TResponse;
};

export type BridgeAssetsPayload = {
  from: string;
  sourceChainId: number;
  destinationChainId: number;
  tokenAddress: string;
  amountWei?: string;
  minAmountWei?: string;
  slippageBps?: number;
  metadata?: Record<string, unknown>;
};

export type SwapTokensPayload = {
  from: string;
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: string;
  minAmountOutWei?: string;
  slippageBps?: number;
  metadata?: Record<string, unknown>;
};

export type BridgeSwapResult = {
  transactionId: string;
  steps?: Array<Record<string, unknown>>;
};

export const bridgeAssetsViaThirdweb = async (
  payload: BridgeAssetsPayload,
): Promise<BridgeSwapResult> => {
  const requestBody: BridgeSwapRequest = {
    from: payload.from,
    exact: "input",
    tokenIn: {
      address: payload.tokenAddress,
      chainId: payload.sourceChainId,
      amount: payload.amountWei,
    },
    tokenOut: {
      address: payload.tokenAddress,
      chainId: payload.destinationChainId,
      minAmount: payload.minAmountWei,
    },
    slippageToleranceBps: payload.slippageBps ?? null,
    metadata: payload.metadata,
  };

  const response = await postJson<BridgeSwapResponse>("/v1/bridge/swap", requestBody);
  return {
    transactionId: response.result.transactionId,
    steps: response.result.steps,
  };
};

export const swapTokensViaThirdweb = async (
  payload: SwapTokensPayload,
): Promise<BridgeSwapResult> => {
  const requestBody: BridgeSwapRequest = {
    from: payload.from,
    exact: "input",
    tokenIn: {
      address: payload.tokenIn,
      chainId: payload.chainId,
      amount: payload.amountInWei,
    },
    tokenOut: {
      address: payload.tokenOut,
      chainId: payload.chainId,
      minAmount: payload.minAmountOutWei,
    },
    slippageToleranceBps: payload.slippageBps ?? null,
    metadata: payload.metadata,
  };

  const response = await postJson<BridgeSwapResponse>("/v1/bridge/swap", requestBody);
  return {
    transactionId: response.result.transactionId,
    steps: response.result.steps,
  };
};
