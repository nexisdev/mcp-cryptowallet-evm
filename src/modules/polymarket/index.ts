import { FastMCP } from "fastmcp";
import { z } from "zod";
import { SessionMetadata } from "../../server/types.js";

const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";

export const registerPolymarketModule = (server: FastMCP<SessionMetadata>) => {
    server.addTool({
        name: "polymarket_search_events",
        description: "Search for events on Polymarket",
        parameters: z.object({
            q: z.string(),
            limit_per_type: z.number().default(10),
            events_status: z.string().optional(),
        }),
        execute: async ({ q, limit_per_type, events_status }) => {
            const url = new URL(`${GAMMA_BASE_URL}/public-search`);
            url.searchParams.append("q", q);
            url.searchParams.append("limit_per_type", limit_per_type.toString());
            if (events_status) url.searchParams.append("events_status", events_status);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            return JSON.stringify({
                events: data.events || [],
                _summary: `Found ${data.events?.length || 0} events for query "${q}".`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "polymarket_get_events",
        description: "Fetch list of events from Polymarket",
        parameters: z.object({
            limit: z.number().default(10),
            offset: z.number().default(0),
            order: z.string().default("volume,markets.volume"),
            ascending: z.boolean().default(false),
            id: z.array(z.number()).optional(),
            slug: z.array(z.string()).optional(),
            closed: z.boolean().optional(),
        }),
        execute: async ({ limit, offset, order, ascending, id, slug, closed }) => {
            const url = new URL(`${GAMMA_BASE_URL}/events`);
            url.searchParams.append("limit", limit.toString());
            url.searchParams.append("offset", offset.toString());
            url.searchParams.append("order", order);
            url.searchParams.append("ascending", ascending.toString());
            if (id) url.searchParams.append("id", id.join(","));
            if (slug) url.searchParams.append("slug", slug.join(","));
            if (closed !== undefined) url.searchParams.append("closed", closed.toString());

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            return JSON.stringify({
                events: data,
                _summary: `Retrieved ${data.length} events.`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "polymarket_get_markets",
        description: "Fetch list of markets from Polymarket",
        parameters: z.object({
            limit: z.number().default(10),
            offset: z.number().default(0),
            order: z.string().default("volume"),
            ascending: z.boolean().default(false),
            id: z.array(z.number()).optional(),
            slug: z.array(z.string()).optional(),
            closed: z.boolean().optional(),
        }),
        execute: async ({ limit, offset, order, ascending, id, slug, closed }) => {
            const url = new URL(`${GAMMA_BASE_URL}/markets`);
            url.searchParams.append("limit", limit.toString());
            url.searchParams.append("offset", offset.toString());
            url.searchParams.append("order", order);
            url.searchParams.append("ascending", ascending.toString());
            if (id) url.searchParams.append("id", id.join(","));
            if (slug) url.searchParams.append("slug", slug.join(","));
            if (closed !== undefined) url.searchParams.append("closed", closed.toString());

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            return JSON.stringify({
                markets: data,
                _summary: `Retrieved ${data.length} markets.`,
            }, null, 2);
        },
    });
};
