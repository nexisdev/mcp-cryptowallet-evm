type RequestOptions = Record<string, string | number | boolean | undefined>;

export class CoinGeckoClient {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl = "https://api.coingecko.com/api/v3/onchain",
  ) {}

  private buildUrl(path: string, params?: RequestOptions): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }

  private get headers(): Record<string, string> {
    return this.apiKey
      ? { "x-cg-demo-api-key": this.apiKey }
      : {};
  }

  private async get<T>(path: string, params?: RequestOptions): Promise<T> {
    const response = await fetch(this.buildUrl(path, params), {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`CoinGecko request failed with HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getTokenPrice(
    network: string,
    addresses: string,
    options: {
      includeMarketCap?: boolean;
      include24hVolume?: boolean;
    } = {},
  ): Promise<unknown> {
    return this.get(
      `/simple/networks/${network}/token_price/${addresses}`,
      {
        include_market_cap: options.includeMarketCap,
        include_24hr_vol: options.include24hVolume,
      },
    );
  }

  async getNetworks(page?: number): Promise<unknown> {
    return this.get("/networks", { page });
  }

  async getSupportedDexes(network: string, page?: number): Promise<unknown> {
    return this.get(`/networks/${network}/dexes`, { page });
  }

  async getTrendingPools(
    network?: string,
    options: { duration?: string; page?: number } = {},
  ): Promise<unknown> {
    if (network) {
      return this.get(`/networks/${network}/trending_pools`, options);
    }
    return this.get("/networks/trending_pools", options);
  }
}
