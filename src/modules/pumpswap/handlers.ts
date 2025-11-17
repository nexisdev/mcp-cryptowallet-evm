import { UserError } from "fastmcp";
import { formatKeyValue } from "../wallet/utils.js";
import { PumpSwapClient, PumpSwapQuoteParams } from "./client.js";
import {
  getPumpSwapConfig,
  setPumpSwapConfig,
} from "./state.js";
import type { ServerContext } from "../../server/types.js";

type PumpSwapContext = ServerContext;

const createClient = (context: PumpSwapContext): PumpSwapClient => {
  const { quoteEndpoint, priceEndpoint, tokenEndpoint } = getPumpSwapConfig(context);
  return new PumpSwapClient(quoteEndpoint, priceEndpoint, tokenEndpoint);
};

export const setPumpSwapProviderHandler = async (
  params: {
    quoteEndpoint?: string;
    priceEndpoint?: string;
    tokenEndpoint?: string;
    slippageBps?: number;
  },
  context: PumpSwapContext,
): Promise<string> => {
  const current = getPumpSwapConfig(context);
  const config = {
    quoteEndpoint: params.quoteEndpoint ?? current.quoteEndpoint,
    priceEndpoint: params.priceEndpoint ?? current.priceEndpoint,
    tokenEndpoint: params.tokenEndpoint ?? current.tokenEndpoint,
    slippageBps: params.slippageBps ?? current.slippageBps,
  };

  (["quoteEndpoint", "priceEndpoint", "tokenEndpoint"] as const).forEach((key) => {
    const value = config[key];
    try {
      new URL(value);
    } catch {
      throw new UserError(`${key} must be a valid URL`);
    }
  });

  setPumpSwapConfig(context, config);
  return formatKeyValue("PumpSwap endpoints configured", config);
};

export const getPriceHandler = async (
  params: { mint: string },
  context: PumpSwapContext,
): Promise<string> => {
  const client = createClient(context);
  const priceResponse = await client.getPrice(params.mint);
  const data = priceResponse.data[params.mint];
  if (!data) {
    return "No price data available for the specified mint.";
  }

  return formatKeyValue("PumpSwap price", {
    mint: data.id,
    symbol: data.mintSymbol ?? "n/a",
    price: `$${data.price}`,
    vsToken: data.vsTokenSymbol ?? "USDC",
    change24h: data.priceChange24h !== undefined ? `${data.priceChange24h.toFixed(2)}%` : "n/a",
  });
};

export const getQuoteHandler = async (
  params: PumpSwapQuoteParams,
  context: PumpSwapContext,
): Promise<string> => {
  const config = getPumpSwapConfig(context);
  const client = createClient(context);
  const quote = await client.getQuote({
    ...params,
    slippageBps: params.slippageBps ?? config.slippageBps ?? 50,
  });

  const route = quote.routePlan[0]?.swapInfo;
  return formatKeyValue("PumpSwap quote", {
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    priceImpactPct: `${(quote.priceImpactPct * 100).toFixed(2)}%`,
    slippageBps: quote.slippageBps,
    route: route ? `${route.label} (${route.ammKey})` : "n/a",
  });
};

export const getTokenInfoHandler = async (
  params: { mint: string },
  context: PumpSwapContext,
): Promise<string> => {
  const client = createClient(context);
  const info = await client.getTokenInfo(params.mint);

  if (!info) {
    return "Token metadata not found.";
  }

  return formatKeyValue("PumpSwap token metadata", {
    address: info.address,
    name: info.name,
    symbol: info.symbol,
    decimals: info.decimals,
    logo: info.logoURI ?? "n/a",
    tags: info.tags?.join(", ") ?? "n/a",
  });
};
