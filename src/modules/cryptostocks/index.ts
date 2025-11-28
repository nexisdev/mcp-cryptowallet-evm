import { FastMCP } from "fastmcp";
import { z } from "zod";
import yahooFinance from "yahoo-finance2";
import { SessionMetadata } from "../../server/types.js";

const CRYPTO_STOCKS: Record<string, string> = {
    "BMNR": "BitMine Immersion Technologies, Inc.",
    "CRCL": "Circle Internet Group Inc.",
    "SBET": "SharpLink Gaming Inc.",
    "SRM": "Tron Inc.",
    "DFDV": "DeFi Development Corp.",
    "MSTR": "MicroStrategy Incorporated",
    "COIN": "Coinbase Global Inc.",
    "MARA": "Marathon Digital Holdings",
    "RIOT": "Riot Platforms Inc.",
    "HIVE": "HIVE Digital Technologies",
    "CORZ": "Core Scientific Inc.",
    "IREN": "Iris Energy Limited",
    "CLSK": "CleanSpark Inc.",
    "HUT": "Hut 8 Corp",
    "CIFR": "Cipher Mining Inc.",
    "BITF": "Bitfarms Ltd",
};

export const registerCryptoStocksModule = (server: FastMCP<SessionMetadata>) => {
    server.addTool({
        name: "cryptostocks_list",
        description: "List available crypto-related stocks",
        parameters: z.object({}),
        execute: async () => {
            const stocks = Object.entries(CRYPTO_STOCKS).map(([ticker, name]) => ({
                ticker,
                name,
            }));
            return JSON.stringify({
                stocks,
                _summary: `Listed ${stocks.length} crypto-related stocks.`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "cryptostocks_price",
        description: "Get real-time price for a stock",
        parameters: z.object({
            ticker: z.string(),
        }),
        execute: async ({ ticker }) => {
            if (!CRYPTO_STOCKS[ticker]) {
                throw new Error(`Unknown ticker ${ticker}. Available: ${Object.keys(CRYPTO_STOCKS).join(", ")}`);
            }

            const quote: any = await yahooFinance.quote(ticker);
            return JSON.stringify({
                ticker,
                name: CRYPTO_STOCKS[ticker],
                price: quote.regularMarketPrice,
                timestamp: quote.regularMarketTime,
                _summary: `${ticker} price: $${quote.regularMarketPrice}`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "cryptostocks_history",
        description: "Fetch historical stock prices",
        parameters: z.object({
            ticker: z.string(),
            days: z.number().default(30),
        }),
        execute: async ({ ticker, days }) => {
            if (!CRYPTO_STOCKS[ticker]) {
                throw new Error(`Unknown ticker ${ticker}.`);
            }

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);

            const queryOptions = { period1: startDate, period2: endDate };
            const result: any[] = await yahooFinance.historical(ticker, queryOptions);

            return JSON.stringify({
                history: result.map((row) => ({
                    date: row.date.toISOString().split("T")[0],
                    close: row.close,
                    volume: row.volume,
                })),
                _summary: `Retrieved ${result.length} days of history for ${ticker}.`,
            }, null, 2);
        },
    });
};
