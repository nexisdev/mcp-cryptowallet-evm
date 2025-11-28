import { z } from "zod";

export const DefiTradingSchemas = {
    getSwapPrice: z.object({
        chainId: z.number().describe("Chain ID (e.g., 1 for Ethereum, 8453 for Base)"),
        buyToken: z.string().describe("Address of the token to buy"),
        sellToken: z.string().describe("Address of the token to sell"),
        sellAmount: z.string().describe("Amount of sellToken to swap (in base units)"),
        taker: z.string().optional().describe("Address of the taker (optional)"),
    }),

    getSwapQuote: z.object({
        chainId: z.number().describe("Chain ID"),
        buyToken: z.string().describe("Address of the token to buy"),
        sellToken: z.string().describe("Address of the token to sell"),
        sellAmount: z.string().describe("Amount of sellToken to swap (in base units)"),
        taker: z.string().optional().describe("Address of the taker"),
        slippagePercentage: z.number().optional().describe("Slippage tolerance (e.g., 0.01 for 1%)"),
    }),

    executeSwap: z.object({
        quoteData: z.any().describe("The quote data returned from get_swap_quote"),
    }),

    getGaslessQuote: z.object({
        chainId: z.number().describe("Chain ID"),
        buyToken: z.string().describe("Address of the token to buy"),
        sellToken: z.string().describe("Address of the token to sell"),
        sellAmount: z.string().describe("Amount of sellToken to swap (in base units)"),
        taker: z.string().optional().describe("Address of the taker"),
    }),

    submitGaslessSwap: z.object({
        quoteData: z.any().describe("The quote data returned from get_gasless_quote"),
    }),

    getGaslessStatus: z.object({
        tradeHash: z.string().describe("The trade hash returned from submit_gasless_swap"),
        chainId: z.number().describe("Chain ID"),
    }),

    getPortfolioTokens: z.object({
        addresses: z.array(z.string()).optional().describe("List of wallet addresses to fetch tokens for"),
        networks: z.array(z.string()).optional().describe("List of networks to include (e.g., ['eth-mainnet'])"),
        withMetadata: z.boolean().optional().describe("Include token metadata"),
        withPrices: z.boolean().optional().describe("Include token prices"),
    }),

    getPortfolioBalances: z.object({
        addresses: z.array(z.string()).optional().describe("List of wallet addresses"),
        networks: z.array(z.string()).optional().describe("List of networks"),
    }),

    getPortfolioTransactions: z.object({
        addresses: z.array(z.string()).optional().describe("List of wallet addresses"),
        networks: z.array(z.string()).optional().describe("List of networks"),
        limit: z.number().optional().describe("Max number of transactions"),
    }),

    getTokenPrice: z.object({
        network: z.string().describe("Network id (e.g., 'ethereum')"),
        addresses: z.string().describe("Comma-separated token addresses"),
        include_market_cap: z.string().optional(),
        include_24hr_vol: z.string().optional(),
        include_24hr_change: z.string().optional(),
    }),

    getTrendingPools: z.object({
        duration: z.string().optional().describe("Duration (24h, 6h, 1h)"),
    }),

    searchPools: z.object({
        query: z.string().describe("Search query (token symbol, name, or address)"),
        network: z.string().optional().describe("Filter by network"),
    }),
};
