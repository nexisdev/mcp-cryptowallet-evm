# FastMCP Migration Plan

Last updated: 2025-11-17

This document captures the high-level approach for upgrading the EVM crypto wallet MCP server to FastMCP-first architecture and integrating the Kukapay MCP ecosystem. It maps cross-cutting FastMCP capabilities to concrete workstreams and enumerates the additional MCP servers slated for inclusion.

## 1. Platform Baseline

- **Current state**: TypeScript FastMCP server (`fastmcp@3.23.1`) exposing wallet, DeFi, bridging, and research modules. Runtime services include Pino logging, Redis-backed session storage, and per-tool middleware for telemetry and error handling.
- **Goal state**: Production-ready FastMCP deployment with unified logging/context, FastMCP-native tool definitions, reusable prompts, and composable sub-servers sourced from Kukapay’s MCP catalog.

## 2. Core Upgrade Pillars

| Pillar | Objectives | Notes |
| --- | --- | --- |
| **Runtime & Storage** | Adopt FastMCP storage provider abstraction, align session context with `Context` contract, introduce namespace isolation per tenant/tier, document Redis & fallback configuration. | Enforce namespace scheme `<tier>:<sessionId>` and expose storage health via `/health`. |
| **Logging & Telemetry** | Replace ad-hoc Pino usage with `fastmcp.logging` helpers, add request-scoped correlation IDs, forward structured logs to middleware. | Use `createLogger` wrapper to emit FastMCP log levels and integrate progress reporting + failure tagging. |
| **Middleware** | Centralize middleware registration (`server.useMiddleware` when available) for telemetry, metrics, progress, rate limiting, and auth/tier enforcement. | Extend `metricsMiddleware` to push session usage to storage + optional Redis time-series. |
| **Prompts & Context** | Reorganize prompts under `/src/prompts`, implement lazy loaders with inference metadata, add tenant-aware prompt variants (e.g., Free vs Ultra). | Map prompts via FastMCP prompt registry with tags for wallet, DeFi, analytics. |
| **Tool Composition** | Convert existing modules to `fastmcp` tool builders with schema metadata, guard rails, and output channels (text/resource). | Use tool transformation patterns for wrapper tools (e.g., summary tools). |
| **Documentation & Compliance** | Update production checklist, connectors guide, and tool inventory. Capture integration notes per new server. | Track actions in Summary Table & tool-usage.md after each integration. |

## 3. Kukapay MCP Integrations

We will onboard the following repositories as modular FastMCP tool packs. Each pack will live under `src/modules/<slug>` with co-located schemas, handlers, and registration utilities.

| Repository | Planned Module Slug | Primary Capabilities | Dependencies / Notes |
| --- | --- | --- | --- |
| `findblock-mcp` | `findblock` | Block lookup by timestamp, chain discovery, RPC proxying | Requires JSON-RPC provider catalog + Chainlist dataset. |
| `pumpfun-wallets-mcp` | `pumpfunWallets` | Pump.fun wallet analytics (profitability, volume tiers) | Needs Dune API client and caching of expensive queries. |
| `honeypot-detector-mcp` | `honeypotDetector` | Token risk scoring, honeypot detection heuristics | Pulls from RugDoc / dexscreener APIs; ensure rate limits. |
| `ens-mcp` | `ens` | ENS domain resolution, reverse lookups, metadata | Depends on Ethers provider + ENS subgraph. |
| `chainlist-mcp` | `chainlist` | Chain metadata catalog, RPC endpoint discovery | Bundle Chainlist dataset; add cache + TTLs. |
| `rug-check-mcp` | `rugCheck` | Token contract risk analysis leveraging RugCheck API | Introduce API key management via session storage. |
| `nft-analytics-mcp` | `nftAnalytics` | NFT floor prices, collection stats, sales feeds | Integrate Reservoir/Alchemy endpoints. |
| `crypto-projects-mcp` | `cryptoProjects` | DeFiLlama protocol metrics, trending projects | Extend existing module with advanced queries. |
| `solana-launchpads-mcp` | `solanaLaunchpads` | Launchpad listings, filterable by status/network | Requires Solana RPC + third-party APIs. |
| `memecoin-radar-mcp` | `memecoinRadar` | Trending memecoins, social metrics, risk tags | Use DexScreener + social sentiment APIs. |
| `crypto-whitepapers-mcp` | `whitepapers` | Search/download crypto whitepapers as resources | Implement resource templates returning PDFs. |
| `token-minter-mcp` | `tokenMinter` | ERC20/ERC721 deployment orchestration, template code | Reuse ethers tooling, add safety prompts. |
| `whattimeisit-mcp` | `worldClock` | Multi-timezone clock, meeting planner | Pure computation; use context caching for timezones. |
| `nearby-search-mcp` | `nearbySearch` | Geo search for amenities using Maps APIs | Configure API key per session, rate limit aggressively. |

## 4. Incremental Delivery Plan

1. **Foundational Upgrade**
   - Align runtime bootstrap (`createServer`) with FastMCP logging/context modules.
   - Expose standardized middleware stack via server-level registration.
   - Harden session storage (namespace isolation, TTLs) and document environment variables.
2. **Module Modernisation**
   - Migrate existing modules (wallet, BSC, DeFi, etc.) to new tool builder pattern.
   - Apply tool transformation wrappers (summary, validation, caching) to high-traffic tools.
3. **Kukapay Packs Integration**
   - Onboard external modules in batches (infra-friendly first: findblock, chainlist, ens).
   - After each module, update `tool-usage.md`, `tools.json`, and Summary Table.
4. **Documentation & Validation**
   - Refresh connectors guide, production checklist, and new module READMEs.
   - Implement automated smoke tests (Jest) per module using mocked APIs.
   - Validate via `fastmcp dev` and record outcomes.

## 5. Risks & Mitigations

- **API Quotas**: Introduce configurable throttling + cache layers for third-party APIs (Dune, Maps, etc.).
- **Schema Drift**: Centralize Zod schemas per module and generate JSON Schema snapshots for OpenAI compatibility.
- **Security**: Expand middleware to redact secrets, enforce tier gating, and sandbox token minter operations.
- **Operational Load**: Provide feature flags to enable/disable heavy modules via env config.

## 6. Tracking & Reporting

- Maintain integration status via Summary Table of Repositories (see final report template).
- Log validation status post-integration (success/failure) in commit notes and `tool-usage.md`.
- Capture incompatibilities in `Error and Incompatibility` JSON report for transparency.

