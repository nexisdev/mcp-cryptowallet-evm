import { UserError } from "fastmcp";

export class DebankClient {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string,
  ) {}

  private buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const url = new URL(path.replace(/^\//, ""), this.endpoint);
    if (query) {
      Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .forEach(([key, value]) => url.searchParams.set(key, value!));
    }
    return url.toString();
  }

  private async request<T>(
    path: string,
    query?: Record<string, string | undefined>,
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const headers = new Headers({ Accept: "application/json" });

    if (this.apiKey) {
      headers.set("access-key", this.apiKey);
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const body = await response.text();
      throw new UserError(
        `DeBank API responded with ${response.status}`,
        { body },
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new UserError("Failed to parse DeBank response", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getTotalBalance(address: string): Promise<DebankTotalBalance> {
    return this.request<DebankTotalBalance>("/v1/user/total_balance", { id: address });
  }

  getTokenList(address: string): Promise<DebankTokenList> {
    return this.request<DebankTokenList>("/v1/user/token_list", {
      id: address,
      is_all: "true",
    });
  }

  getProtocolList(address: string): Promise<DebankProtocolList> {
    return this.request<DebankProtocolList>("/v1/user/protocol_list", {
      id: address,
    });
  }

  getTokenInfo(chain: string, address: string): Promise<DebankTokenInfo> {
    return this.request<DebankTokenInfo>("/v1/token", {
      chain_id: chain,
      id: address,
    });
  }
}

export type DebankTotalBalance = {
  total_usd_value: number;
  chain_list: Array<{
    id: string;
    usd_value: number;
  }>;
};

export type DebankTokenList = Array<{
  id: string;
  chain: string;
  symbol: string;
  amount: number;
  price: number;
  usd_value: number;
  logo_url?: string;
}>;

export type DebankProtocolList = Array<{
  id: string;
  name: string;
  portfolio_item_list: Array<{
    stats: {
      asset_usd_value?: number;
      debt_usd_value?: number;
      net_usd_value?: number;
    };
  }>;
}>;

export type DebankTokenInfo = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  price_24h_change: number;
  market_cap?: number;
  volume_24h?: number;
  logo_url?: string;
};

