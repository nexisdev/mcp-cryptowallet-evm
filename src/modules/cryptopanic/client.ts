import { UserError } from "fastmcp";

export type CryptoPanicQuery = {
  kind?: "news" | "media";
  currencies?: string[];
  publicOnly?: boolean;
  page?: number;
};

export type CryptoPanicPost = {
  title: string;
  url: string;
  published_at: string;
  source: {
    title: string;
    domain: string;
  };
  currencies?: Array<{ code: string }>;
};

export type CryptoPanicResponse = {
  count: number;
  next?: string | null;
  results: CryptoPanicPost[];
};

export class CryptoPanicClient {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string,
  ) {}

  async fetchPosts(query: CryptoPanicQuery = {}): Promise<CryptoPanicResponse> {
    const base = new URL("/api/v1/posts/", this.endpoint);

    if (this.apiKey) {
      base.searchParams.set("auth_token", this.apiKey);
    }

    base.searchParams.set("public", query.publicOnly ? "true" : "false");

    if (query.kind) {
      base.searchParams.set("kind", query.kind);
    }

    if (query.currencies?.length) {
      base.searchParams.set("currencies", query.currencies.join(","));
    }

    if (query.page) {
      base.searchParams.set("page", String(query.page));
    }

    const response = await fetch(base, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new UserError(
        `CryptoPanic API responded with ${response.status}`,
        { body: payload },
      );
    }

    try {
      return (await response.json()) as CryptoPanicResponse;
    } catch (error) {
      throw new UserError("Failed to parse CryptoPanic response", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

