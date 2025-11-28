import { FastMCP } from "fastmcp";
import { z } from "zod";
import { SessionMetadata } from "../../server/types.js";

const CRYPTORANK_API_BASE = "https://api.cryptorank.io/v2";

export const registerCryptoFundsModule = (server: FastMCP<SessionMetadata>) => {
    server.addTool({
        name: "cryptofunds_search",
        description: "Search funds and investors with filters",
        parameters: z.object({
            tier: z.array(z.number()).optional(),
            type: z.array(z.string()).optional(),
            sortBy: z.string().default("tier"),
            sortDirection: z.enum(["ASC", "DESC"]).default("ASC"),
            limit: z.number().default(100),
            skip: z.number().default(0),
        }),
        execute: async ({ tier, type, sortBy, sortDirection, limit, skip }) => {
            const apiKey = process.env.CRYPTORANK_API_KEY;
            if (!apiKey) throw new Error("CRYPTORANK_API_KEY environment variable not set.");

            const url = new URL(`${CRYPTORANK_API_BASE}/funds`);
            url.searchParams.append("sortBy", sortBy);
            url.searchParams.append("sortDirection", sortDirection);
            url.searchParams.append("limit", limit.toString());
            url.searchParams.append("skip", skip.toString());

            if (tier) tier.forEach(t => url.searchParams.append("tier", t.toString()));
            if (type) type.forEach(t => url.searchParams.append("type", t));

            const response = await fetch(url.toString(), {
                headers: { "X-Api-Key": apiKey },
            });
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            return JSON.stringify({
                funds: data.data,
                _summary: `Found ${data.data.length} funds matching criteria.`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "cryptofunds_get_all",
        description: "Get all funds (mapped)",
        parameters: z.object({}),
        execute: async () => {
            const apiKey = process.env.CRYPTORANK_API_KEY;
            if (!apiKey) throw new Error("CRYPTORANK_API_KEY environment variable not set.");

            const response = await fetch(`${CRYPTORANK_API_BASE}/funds/map`, {
                headers: { "X-Api-Key": apiKey },
            });
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            return JSON.stringify({
                funds: data.data,
                _summary: `Retrieved ${data.data.length} funds from map.`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "cryptofunds_get_basic",
        description: "Get basic metrics for a fund",
        parameters: z.object({
            fundId: z.number(),
        }),
        execute: async ({ fundId }) => {
            const apiKey = process.env.CRYPTORANK_API_KEY;
            if (!apiKey) throw new Error("CRYPTORANK_API_KEY environment variable not set.");

            const response = await fetch(`${CRYPTORANK_API_BASE}/funds/${fundId}`, {
                headers: { "X-Api-Key": apiKey },
            });
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            return JSON.stringify({
                fund: data.data,
                _summary: `Retrieved basic metrics for fund ID ${fundId}.`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "cryptofunds_get_detail",
        description: "Get comprehensive metrics for a fund",
        parameters: z.object({
            fundId: z.number(),
        }),
        execute: async ({ fundId }) => {
            const apiKey = process.env.CRYPTORANK_API_KEY;
            if (!apiKey) throw new Error("CRYPTORANK_API_KEY environment variable not set.");

            const response = await fetch(`${CRYPTORANK_API_BASE}/funds/${fundId}/full-metadata`, {
                headers: { "X-Api-Key": apiKey },
            });
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            return JSON.stringify({
                fund: data.data,
                _summary: `Retrieved detailed metrics for fund ID ${fundId}.`,
            }, null, 2);
        },
    });
};
