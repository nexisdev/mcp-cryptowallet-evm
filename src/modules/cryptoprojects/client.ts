import { UserError } from "fastmcp";

export class CryptoProjectsClient {
  constructor(private readonly endpoint: string) {}

  async getProtocol(slug: string): Promise<DefiLlamaProtocol> {
    return this.request<DefiLlamaProtocol>(`/protocol/${slug}`);
  }

  async listProtocols(): Promise<DefiLlamaProtocolSummary[]> {
    return this.request<DefiLlamaProtocolSummary[]>("/protocols");
  }

  private async request<T>(path: string): Promise<T> {
    const url = new URL(path.replace(/^\//, ""), this.endpoint);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new UserError(
        `DefiLlama API responded with ${response.status}`,
        { body },
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new UserError("Failed to parse DefiLlama response", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export type DefiLlamaProtocolSummary = {
  name: string;
  symbol: string;
  slug: string;
  tvl: number;
  chain: string;
  category: string;
};

export type DefiLlamaProtocol = DefiLlamaProtocolSummary & {
  chains: string[];
  change_1h: number;
  change_1d: number;
  change_7d: number;
  url: string;
  description?: string;
};

