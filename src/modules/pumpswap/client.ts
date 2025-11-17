import { UserError } from "fastmcp";

export type PumpSwapQuoteParams = {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
};

export class PumpSwapClient {
  constructor(
    private readonly quoteEndpoint: string,
    private readonly priceEndpoint: string,
    private readonly tokenEndpoint: string,
  ) {}

  async getPrice(mint: string): Promise<JupiterPriceResponse> {
    const url = new URL("/v6/price", this.priceEndpoint);
    url.searchParams.set("ids", mint);
    url.searchParams.set("vsToken", "USDC");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    return this.parseResponse<JupiterPriceResponse>(response, "price");
  }

  async getQuote(params: PumpSwapQuoteParams): Promise<JupiterQuoteResponse> {
    const url = new URL("/v6/quote", this.quoteEndpoint);
    url.searchParams.set("inputMint", params.inputMint);
    url.searchParams.set("outputMint", params.outputMint);
    url.searchParams.set("amount", params.amount.toString());
    url.searchParams.set("slippageBps", String(params.slippageBps ?? 50));
    url.searchParams.set("onlyDirectRoutes", "true");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    return this.parseResponse<JupiterQuoteResponse>(response, "quote");
  }

  async getTokenInfo(mint: string): Promise<JupiterTokenInfo | undefined> {
    const url = new URL(`/token/${mint}`, this.tokenEndpoint);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) {
      return undefined;
    }
    return this.parseResponse<JupiterTokenInfo>(response, "token");
  }

  private async parseResponse<T>(response: Response, label: string): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      throw new UserError(
        `Jupiter ${label} API responded with ${response.status}`,
        { body },
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new UserError(`Failed to parse Jupiter ${label} response`, {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export type JupiterPriceResponse = {
  data: Record<string, {
    id: string;
    price: number;
    mintSymbol?: string;
    vsTokenSymbol?: string;
    priceChange24h?: number;
  }>;
};

export type JupiterQuoteResponse = {
  inputMint: string;
  outputMint: string;
  inAmount: number;
  outAmount: number;
  otherAmountThreshold: number;
  slippageBps: number;
  priceImpactPct: number;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
    };
  }>;
};

export type JupiterTokenInfo = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
};

