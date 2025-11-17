type SwapParams = {
  chainId: number;
  buyToken: string;
  sellToken: string;
  sellAmount: string;
  taker?: string;
  slippageBps?: number;
};

export class AggregatorClient {
  constructor(private readonly baseUrl: string) {}

  private buildUrl(path: string, searchParams?: Record<string, unknown>): string {
    const url = new URL(path, this.baseUrl);
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }

  private async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.buildUrl(path, params));
    if (!response.ok) {
      throw new Error(`Aggregator request failed with HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { success?: boolean; data?: T; error?: string };
    if (payload.success === false) {
      throw new Error(payload.error ?? "Aggregator API error");
    }
    if (!payload.data) {
      throw new Error("Aggregator response missing data");
    }
    return payload.data;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(this.buildUrl(path), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Aggregator request failed with HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { success?: boolean; data?: T; error?: string };
    if (payload.success === false) {
      throw new Error(payload.error ?? "Aggregator API error");
    }
    if (!payload.data) {
      throw new Error("Aggregator response missing data");
    }
    return payload.data;
  }

  async getSwapPrice(params: SwapParams): Promise<unknown> {
    return this.get("/api/swap/price", params);
  }

  async getSwapQuote(params: SwapParams): Promise<unknown> {
    return this.get("/api/swap/quote", params);
  }

  async getSupportedChains(): Promise<unknown> {
    return this.get("/api/swap/chains");
  }

  async getLiquiditySources(chainId: number): Promise<unknown> {
    return this.get("/api/swap/sources", { chainId });
  }
}
