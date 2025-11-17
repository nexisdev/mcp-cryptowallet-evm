import { UserError } from "fastmcp";

type RequestMethod = "GET" | "POST";

const ensureTrailingSlash = (url: string): string => (url.endsWith("/") ? url : `${url}/`);

export class WormholeClient {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string,
  ) {}

  private async request<T>(
    path: string,
    method: RequestMethod,
    body?: unknown,
  ): Promise<T> {
    const target = new URL(path.replace(/^\//, ""), ensureTrailingSlash(this.endpoint));
    const headers = new Headers();
    headers.set("Accept", "application/json");
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    const response = await fetch(target, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new UserError(
        `Wormhole API responded with ${response.status}`,
        { body: sanitizeErrorPayload(payload) },
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new UserError("Unable to parse Wormhole API response as JSON", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  listRoutes(): Promise<WormholeRoutesResponse> {
    return this.request<WormholeRoutesResponse>("/v1/routes", "GET");
  }

  getRouteStatus(sourceChain: string, targetChain: string): Promise<WormholeRouteStatusResponse> {
    const query = new URLSearchParams({
      sourceChain,
      targetChain,
    }).toString();
    return this.request<WormholeRouteStatusResponse>(`/v1/routes/status?${query}`, "GET");
  }

  quoteTransfer(payload: WormholeQuoteRequest): Promise<WormholeQuoteResponse> {
    return this.request<WormholeQuoteResponse>("/v1/quotes", "POST", payload);
  }

  createTransfer(payload: WormholeTransferRequest): Promise<WormholeTransferResponse> {
    return this.request<WormholeTransferResponse>("/v1/transfers", "POST", payload);
  }

  getTransferStatus(transferId: string): Promise<WormholeTransferResponse> {
    return this.request<WormholeTransferResponse>(`/v1/transfers/${transferId}`, "GET");
  }
}

const sanitizeErrorPayload = (payload: string): string => {
  if (!payload) {
    return "";
  }

  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed === "object" && parsed !== null) {
      return JSON.stringify(parsed);
    }
  } catch {
    // ignore – return raw text
  }

  return payload;
};

export type WormholeRoutesResponse = {
  routes: Array<{
    sourceChain: string;
    targetChain: string;
    token: string;
    bridge: string;
  }>;
};

export type WormholeRouteStatusResponse = {
  status: "operational" | "degraded" | "paused";
  etaMinutes: number;
};

export type WormholeQuoteRequest = {
  sourceChain: string;
  targetChain: string;
  tokenAddress: string;
  amount: string;
  recipient: string;
};

export type WormholeQuoteResponse = {
  quoteId: string;
  estimatedFee: string;
  expirySeconds: number;
};

export type WormholeTransferRequest = WormholeQuoteRequest & {
  quoteId: string;
  wallet?: string;
};

export type WormholeTransferResponse = {
  transferId: string;
  status: "pending" | "completed" | "failed";
  etaMinutes?: number;
  explorerUrl?: string;
};

