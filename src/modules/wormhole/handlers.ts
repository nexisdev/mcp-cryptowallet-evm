import { UserError } from "fastmcp";
import { formatKeyValue } from "../wallet/utils.js";
import {
  WORMHOLE_NAMESPACE,
  WORMHOLE_SUPPORTED_CHAINS,
} from "./constants.js";
import {
  WormholeClient,
  WormholeQuoteRequest,
  WormholeTransferRequest,
} from "./client.js";
import {
  getWormholeConfig,
  setWormholeConfig,
} from "./state.js";
import type { ServerContext } from "../../server/types.js";

type WormholeContext = ServerContext;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createClient = (context: WormholeContext): WormholeClient => {
  const { endpoint, apiKey } = getWormholeConfig(context);
  return new WormholeClient(endpoint, apiKey);
};

export const setWormholeEndpointHandler = async (
  params: { endpoint: string; apiKey?: string },
  context: WormholeContext,
): Promise<string> => {
  try {
    new URL(params.endpoint);
  } catch {
    throw new UserError("endpoint must be a valid URL");
  }

  setWormholeConfig(context, {
    endpoint: params.endpoint,
    apiKey: params.apiKey ?? process.env.WORMHOLE_API_KEY,
  });

  return formatKeyValue("Wormhole endpoint configured", {
    endpoint: params.endpoint,
    apiKey: params.apiKey ? "provided" : "inherited",
  });
};

export const bridgeTokenHandler = async (
  params: WormholeQuoteRequest & { wallet?: string },
  context: WormholeContext,
): Promise<string> => {
  const client = createClient(context);

  try {
    context.log.info("[wormhole] quoting transfer", {
      sourceChain: params.sourceChain,
      targetChain: params.targetChain,
      amount: params.amount,
    });

    await context.reportProgress({ progress: 10, total: 100 });
    const quote = await client.quoteTransfer(params);

    await context.reportProgress({ progress: 35, total: 100 });
    context.log.info("[wormhole] creating transfer", { quoteId: quote.quoteId });

    const transferPayload: WormholeTransferRequest = {
      ...params,
      quoteId: quote.quoteId,
    };

    const transfer = await client.createTransfer(transferPayload);

    await context.reportProgress({ progress: 85, total: 100 });
    context.log.info("[wormhole] bridge initiated", { transferId: transfer.transferId });

    await wait(50);
    await context.reportProgress({ progress: 100, total: 100 });

    return formatKeyValue("Wormhole transfer initiated", {
      transferId: transfer.transferId,
      status: transfer.status,
      etaMinutes: transfer.etaMinutes ?? "n/a",
      explorerUrl: transfer.explorerUrl ?? "n/a",
      estimatedFee: quote.estimatedFee,
      quoteExpiresIn: `${quote.expirySeconds} seconds`,
    });
  } catch (error) {
    throw normalizeWormholeError("Failed to initiate Wormhole transfer", error);
  }
};

export const routeStatusHandler = async (
  params: { sourceChain: string; targetChain: string },
  context: WormholeContext,
): Promise<string> => {
  const client = createClient(context);

  try {
    const status = await client.getRouteStatus(params.sourceChain, params.targetChain);
    return formatKeyValue("Wormhole route status", {
      sourceChain: params.sourceChain,
      targetChain: params.targetChain,
      status: status.status,
      etaMinutes: status.etaMinutes,
    });
  } catch (error) {
    throw normalizeWormholeError("Failed to retrieve route status", error);
  }
};

export const supportedRoutesHandler = async (
  _params: Record<string, never>,
  context: WormholeContext,
): Promise<string> => {
  const client = createClient(context);

  try {
    const response = await client.listRoutes();
    if (!response.routes?.length) {
      return "No Wormhole routes available.";
    }
    const lines = response.routes.map(
      (route) => `- ${route.sourceChain} → ${route.targetChain} (${route.bridge})`,
    );
    return ["Supported Wormhole routes:", ...lines].join("\n");
  } catch (error) {
    throw normalizeWormholeError("Failed to list Wormhole routes", error);
  }
};

export const transferStatusHandler = async (
  params: { transferId: string },
  context: WormholeContext,
): Promise<string> => {
  if (!params.transferId) {
    throw new UserError("transferId is required");
  }

  const client = createClient(context);

  try {
    const transfer = await client.getTransferStatus(params.transferId);
    return formatKeyValue("Wormhole transfer status", {
      transferId: transfer.transferId,
      status: transfer.status,
      etaMinutes: transfer.etaMinutes ?? "n/a",
      explorerUrl: transfer.explorerUrl ?? "n/a",
    });
  } catch (error) {
    throw normalizeWormholeError("Failed to retrieve transfer status", error);
  }
};

export const listSupportedChainsHandler = async (): Promise<string> => {
  const lines = WORMHOLE_SUPPORTED_CHAINS.map((chain) => `- ${chain.id}: ${chain.label}`);
  return ["Supported chains:", ...lines].join("\n");
};

const normalizeWormholeError = (prefix: string, error: unknown): UserError => {
  if (error instanceof UserError) {
    return new UserError(prefix, error.extras);
  }
  if (error instanceof Error) {
    return new UserError(prefix, { reason: error.message });
  }
  return new UserError(prefix, { reason: String(error) });
};
