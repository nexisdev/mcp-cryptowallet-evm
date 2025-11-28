import { AGGREGATOR_API_URL, COINGECKO_API_URL, COINGECKO_API_KEY } from "./constants.js";

// Helper for fetch with error handling
async function fetchJson(url: string, options: RequestInit = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    // Check for success field if API returns it (Aggregator API pattern)
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error(data.error || 'API request failed');
    }
    return 'data' in data ? data.data : data;
}

export const AgService = {
    async getSwapPrice(params: any) {
        const queryParams = new URLSearchParams(params as any);
        return fetchJson(`${AGGREGATOR_API_URL}/api/swap/price?${queryParams}`);
    },

    async getSwapQuote(params: any) {
        const queryParams = new URLSearchParams(params as any);
        return fetchJson(`${AGGREGATOR_API_URL}/api/swap/quote?${queryParams}`);
    },

    async submitGaslessSwap(swapData: any) {
        return fetchJson(`${AGGREGATOR_API_URL}/api/swap/gasless/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(swapData)
        });
    },

    async getGaslessQuote(params: any) {
        const queryParams = new URLSearchParams(params as any);
        return fetchJson(`${AGGREGATOR_API_URL}/api/swap/gasless/quote?${queryParams}`);
    },

    async getGaslessStatus(tradeHash: string, chainId: number) {
        return fetchJson(`${AGGREGATOR_API_URL}/api/swap/gasless/status/${tradeHash}?chainId=${chainId}`);
    },

    async getPortfolioTokens(addresses: string[], options: any = {}) {
        return fetchJson(`${AGGREGATOR_API_URL}/api/portfolio/tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses, ...options })
        });
    },

    async getPortfolioBalances(addresses: string[], options: any = {}) {
        return fetchJson(`${AGGREGATOR_API_URL}/api/portfolio/balances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses, ...options })
        });
    },

    async getPortfolioTransactions(addresses: string[], options: any = {}) {
        return fetchJson(`${AGGREGATOR_API_URL}/api/portfolio/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses, ...options })
        });
    }
};

export const CoinGeckoService = {
    getHeaders() {
        const headers: Record<string, string> = {
            'accept': 'application/json'
        };
        if (COINGECKO_API_KEY) {
            headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
        }
        return headers;
    },

    async getTokenPrice(network: string, addresses: string, options: any = {}) {
        const queryParams = new URLSearchParams({
            contract_addresses: addresses,
            vs_currencies: 'usd',
            ...options
        });
        return fetchJson(`${COINGECKO_API_URL}/simple/token_price/${network}?${queryParams}`, {
            headers: this.getHeaders()
        });
    },

    async getTrendingPools(options: any = {}) {
        // Note: Endpoint might vary based on CoinGecko API version (public vs pro)
        // Using standard endpoint pattern
        return fetchJson(`${COINGECKO_API_URL}/onchain/networks/trending_pools`, {
            headers: this.getHeaders()
        });
    },

    async searchPools(query: string, options: any = {}) {
        const queryParams = new URLSearchParams({
            query,
            ...options
        });
        return fetchJson(`${COINGECKO_API_URL}/onchain/search/pools?${queryParams}`, {
            headers: this.getHeaders()
        });
    }
};
