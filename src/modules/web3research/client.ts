import { UserError } from "fastmcp";

type FetchOptions = {
  endpoint: string;
  path: string;
  query?: Record<string, string | number | undefined>;
};

const buildUrl = ({ endpoint, path, query }: FetchOptions): string => {
  const url = new URL(path.replace(/^\//, ""), endpoint);
  if (query) {
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  return url.toString();
};

export class Web3ResearchClient {
  constructor(private readonly endpoint: string) {}

  async searchAssets(query: string): Promise<CoinGeckoSearchResponse> {
    return this.request<CoinGeckoSearchResponse>({
      endpoint: this.endpoint,
      path: "/api/v3/search",
      query: { query },
    });
  }

  async getAssetDetails(id: string): Promise<CoinGeckoAssetDetails> {
    return this.request<CoinGeckoAssetDetails>({
      endpoint: this.endpoint,
      path: `/api/v3/coins/${id}`,
      query: {
        localization: "false",
        tickers: "false",
        community_data: "false",
        developer_data: "false",
        sparkline: "false",
      },
    });
  }

  async getTrending(): Promise<CoinGeckoTrendingResponse> {
    return this.request<CoinGeckoTrendingResponse>({
      endpoint: this.endpoint,
      path: "/api/v3/search/trending",
    });
  }

  private async request<T>({ endpoint, path, query }: FetchOptions): Promise<T> {
    const url = buildUrl({ endpoint, path, query });
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new UserError(
        `CoinGecko API responded with ${response.status}`,
        { body },
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new UserError("Failed to parse CoinGecko response", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export type CoinGeckoSearchResponse = {
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    thumb: string;
    large: string;
  }>;
};

export type CoinGeckoAssetDetails = {
  id: string;
  symbol: string;
  name: string;
  description: { en?: string };
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    price_change_percentage_24h?: number;
  };
  image: { large?: string };
  links: { homepage?: string[] };
};

export type CoinGeckoTrendingResponse = {
  coins: Array<{
    item: {
      id: string;
      symbol: string;
      name: string;
      market_cap_rank: number;
      thumb: string;
      price_btc: number;
      score: number;
    };
  }>;
};

