import { UserError } from "fastmcp";
import type { ServerContext } from "../../server/types.js";
import { DEFAULT_ASTER_BASE_URL } from "./constants.js";
import { toMarkdownTable } from "../../core/markdown.js";

const BASE_URL = process.env.ASTER_BASE_URL ?? DEFAULT_ASTER_BASE_URL;

type FetchParams = Record<string, string | number | undefined>;

const buildUrl = (path: string, params?: FetchParams): string => {
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const assertOk = async (response: Response): Promise<void> => {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new UserError(
    `Aster API responded with status ${response.status}: ${body.slice(0, 200)}`,
  );
};

const parseTimestamp = (value: number | string): string => {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return new Date(numeric).toISOString();
};

export type KlineArgs = {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
};

export const getKlineHandler = async (
  args: KlineArgs,
  context: ServerContext,
): Promise<string> => {
  const url = buildUrl("/fapi/v1/klines", {
    symbol: args.symbol.toUpperCase(),
    interval: args.interval,
    startTime: args.startTime,
    endTime: args.endTime,
    limit: args.limit,
  });

  context.log.debug("[aster] fetching klines", { url });

  const response = await fetch(url);
  await assertOk(response);

  const raw = (await response.json()) as Array<Array<string | number>>;
  if (!Array.isArray(raw) || raw.length === 0) {
    return "No kline data returned.";
  }

  const rows = raw.map((entry) => {
    return [
      parseTimestamp(entry[0] as number),
      Number(entry[1]).toFixed(8),
      Number(entry[2]).toFixed(8),
      Number(entry[3]).toFixed(8),
      Number(entry[4]).toFixed(8),
    ];
  });

  const headers = ["open_time", "open", "high", "low", "close"];
  return toMarkdownTable(headers, rows);
};

export type OrderBookTickerArgs = {
  symbol?: string;
};

export const getOrderBookTickerHandler = async (
  args: OrderBookTickerArgs,
  context: ServerContext,
): Promise<string> => {
  const url = buildUrl("/fapi/v1/ticker/bookTicker", {
    symbol: args.symbol?.toUpperCase(),
  });

  context.log.debug("[aster] fetching order book ticker", { url });

  const response = await fetch(url);
  await assertOk(response);

  const payload = await response.json();
  const entries: Array<Record<string, string>> = Array.isArray(payload) ? payload : [payload];

  if (entries.length === 0) {
    return "No order book ticker data returned.";
  }

  const rows = entries.map((item) => [
    item.symbol ?? args.symbol?.toUpperCase() ?? "N/A",
    Number(item.bidPrice ?? 0).toFixed(8),
    Number(item.bidQty ?? 0).toFixed(8),
    Number(item.askPrice ?? 0).toFixed(8),
    Number(item.askQty ?? 0).toFixed(8),
  ]);

  return toMarkdownTable(["symbol", "bidPrice", "bidQty", "askPrice", "askQty"], rows);
};

export type OrderBookArgs = {
  symbol: string;
  limit?: number;
};

export const getOrderBookHandler = async (
  args: OrderBookArgs,
  context: ServerContext,
): Promise<string> => {
  const url = buildUrl("/fapi/v1/depth", {
    symbol: args.symbol.toUpperCase(),
    limit: args.limit,
  });

  context.log.debug("[aster] fetching order book", { url });

  const response = await fetch(url);
  await assertOk(response);

  const payload = (await response.json()) as {
    bids?: Array<[string, string]>;
    asks?: Array<[string, string]>;
    lastUpdateId?: number;
  };

  const bids = payload.bids ?? [];
  const asks = payload.asks ?? [];

  if (bids.length === 0 && asks.length === 0) {
    return "No order book data returned.";
  }

  const maxRows = Math.max(bids.length, asks.length);
  const rows: Array<Array<string>> = [];

  for (let index = 0; index < maxRows; index += 1) {
    const bid = bids[index];
    const ask = asks[index];
    rows.push([
      bid ? Number(bid[0]).toFixed(8) : "",
      bid ? Number(bid[1]).toFixed(8) : "",
      ask ? Number(ask[0]).toFixed(8) : "",
      ask ? Number(ask[1]).toFixed(8) : "",
    ]);
  }

  return [
    `Last update ID: ${payload.lastUpdateId ?? "unknown"}`,
    "",
    toMarkdownTable(
      ["bidPrice", "bidQty", "askPrice", "askQty"],
      rows,
    ),
  ].join("\n");
};

export type RecentTradesArgs = {
  symbol: string;
  limit?: number;
};

export const getRecentTradesHandler = async (
  args: RecentTradesArgs,
  context: ServerContext,
): Promise<string> => {
  const url = buildUrl("/fapi/v1/trades", {
    symbol: args.symbol.toUpperCase(),
    limit: args.limit,
  });

  context.log.debug("[aster] fetching recent trades", { url });

  const response = await fetch(url);
  await assertOk(response);

  const trades = (await response.json()) as Array<Record<string, unknown>>;

  if (!Array.isArray(trades) || trades.length === 0) {
    return "No recent trades found.";
  }

  const rows = trades.map((trade) => [
    String(trade.id ?? trade.tradeId ?? ""),
    Number(trade.price ?? 0).toFixed(8),
    Number(trade.qty ?? trade.quantity ?? 0).toFixed(8),
    Number(trade.quoteQty ?? trade.quoteQuantity ?? 0).toFixed(8),
    parseTimestamp(Number(trade.time ?? trade.timestamp ?? 0)),
    String(trade.isBuyerMaker ?? ""),
  ]);

  return toMarkdownTable(
    ["id", "price", "qty", "quoteQty", "time", "isBuyerMaker"],
    rows,
  );
};
