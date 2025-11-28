import type { FastMCP } from "fastmcp";
import { DefiTradingSchemas } from "./schemas.js";
import {
    getSwapPriceHandler,
    getSwapQuoteHandler,
    executeSwapHandler,
    getGaslessQuoteHandler,
    submitGaslessSwapHandler,
    getPortfolioTokensHandler,
    getPortfolioBalancesHandler,
    getPortfolioTransactionsHandler,
    getTokenPriceHandler,
    getTrendingPoolsHandler,
    searchPoolsHandler
} from "./handlers.js";

export const registerDefiTradingModule = (server: FastMCP<any>) => {
    server.addTool({
        name: "defitrading_get_swap_price",
        description: "Get the price for a token swap.",
        parameters: DefiTradingSchemas.getSwapPrice,
        execute: getSwapPriceHandler,
    });

    server.addTool({
        name: "defitrading_get_swap_quote",
        description: "Get a quote for a token swap, including transaction data.",
        parameters: DefiTradingSchemas.getSwapQuote,
        execute: getSwapQuoteHandler,
    });

    server.addTool({
        name: "defitrading_execute_swap",
        description: "Execute a swap using the quote data. Signs and broadcasts the transaction.",
        parameters: DefiTradingSchemas.executeSwap,
        execute: executeSwapHandler,
    });

    server.addTool({
        name: "defitrading_get_gasless_quote",
        description: "Get a quote for a gasless token swap.",
        parameters: DefiTradingSchemas.getGaslessQuote,
        execute: getGaslessQuoteHandler,
    });

    server.addTool({
        name: "defitrading_submit_gasless_swap",
        description: "Submit a gasless swap using the quote data.",
        parameters: DefiTradingSchemas.submitGaslessSwap,
        execute: submitGaslessSwapHandler,
    });

    server.addTool({
        name: "defitrading_get_portfolio_tokens",
        description: "Get tokens in a portfolio.",
        parameters: DefiTradingSchemas.getPortfolioTokens,
        execute: getPortfolioTokensHandler,
    });

    server.addTool({
        name: "defitrading_get_portfolio_balances",
        description: "Get balances of tokens in a portfolio.",
        parameters: DefiTradingSchemas.getPortfolioBalances,
        execute: getPortfolioBalancesHandler,
    });

    server.addTool({
        name: "defitrading_get_portfolio_transactions",
        description: "Get transactions for a portfolio.",
        parameters: DefiTradingSchemas.getPortfolioTransactions,
        execute: getPortfolioTransactionsHandler,
    });

    server.addTool({
        name: "defitrading_get_token_price",
        description: "Get token price from CoinGecko.",
        parameters: DefiTradingSchemas.getTokenPrice,
        execute: getTokenPriceHandler,
    });

    server.addTool({
        name: "defitrading_get_trending_pools",
        description: "Get trending pools from CoinGecko.",
        parameters: DefiTradingSchemas.getTrendingPools,
        execute: getTrendingPoolsHandler,
    });

    server.addTool({
        name: "defitrading_search_pools",
        description: "Search for pools on CoinGecko.",
        parameters: DefiTradingSchemas.searchPools,
        execute: searchPoolsHandler,
    });
};
