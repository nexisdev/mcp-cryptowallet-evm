# FastMCP Server Architecture & Migration Blueprint

This document inventories the current FastMCP crypto wallet server, maps FastMCP capabilities to product requirements, and outlines the rollout plan for production readiness with OpenAI-compatible connectors.

---

## 1. Baseline Architecture & Dependencies

- **Runtime**: Node.js 18+, TypeScript compiled to ESM (`tsconfig.json` targets ES2022) deployed via `fastmcp` runtime.
- **Entry point**: `src/index.ts` → `createServer` → `startServer`, supporting STDIO and HTTP Stream transports.
- **Core dependencies**:
  - `fastmcp@^3.23.0` – server runtime, context logging, middleware API.
  - `ethers@^5.7.2` – Ethereum-compatible wallet and provider utilities.
  - `keyv@^5.5.4` – optional storage adaptor for future stateful modules.
  - `zod@^3.25.76` – tool input validation schemas.
  - `pino@^10.1.0` – structured logging backend exposed through `context.log`.
- **Module layout** (`src/modules/*`): wallet, BSC, Wormhole, DeBank, DeFi Aggregator, Aave, CryptoPanic, Web3 Research, Crypto Projects, PumpSwap, Aster. Each defines `schemas.ts`, `handlers.ts`, and registration helpers that wrap middleware.
- **Cross-cutting middleware** (`src/core`):
  - `middleware.ts` – telemetry + progress instrumentation applied to every tool.
  - `cache.ts` – response cache factory with shared namespace controls.
- **Prompts** (`src/prompts`) – reusable prompt loaders for transaction confirmation, troubleshooting, and data briefings.
- **Tests** (`tests/modules`) – Jest suites per module with deterministic mocks under `tests/mocks`.

## 2. FastMCP Capability Coverage & Gaps

| Capability | Current Coverage | Gaps / Next Steps |
| --- | --- | --- |
| **Tools** | Zod-validated tools for wallet, BSC, Wormhole, DeBank, DeFi Aggregator, Aave, CryptoPanic, Web3 Research, Crypto Projects, PumpSwap, Aster. All responses normalized to text content via shared helper. | Continue harmonising annotations (`readOnlyHint`) across data providers for richer metadata. |
| **Logging** | `telemetryMiddleware` emits structured `info/error` logs with request IDs; sensitive args redacted. | Expand log metadata with tier/user context once auth is introduced. |
| **Progress** | `progressSafetyMiddleware` guarantees 100% progress callbacks. | Add progressive updates for long-running bridge transfers. |
| **Caching** | Route & feed lookups cached via `createResponseCacheMiddleware` with module-specific namespaces. | Evaluate distributed cache (Redis) prior to horizontal scaling. |
| **Context / Storage** | FastMCP context leveraged for per-request logging & progress; `keyv` available for persistence. | Implement multi-tenant storage bindings (user/org) once auth model defined. |
| **Prompts** | Wallet prompts plus new data-intel templates (see §4). | Add per-tier prompt variants if plan-based messaging differs. |
| **Middleware** | Telemetry + progress applied globally; caching applied per-tool where beneficial. | Introduce auth / rate-limit middleware after identity model is finalised. |

## 3. Target Runtime Layout & Configuration

- **Transport selection**: default STDIO for local tools; `MCP_TRANSPORT=http` enables HTTP Stream for ChatGPT Developer Mode / OpenAI Responses API.
- **HTTP configuration**: `HOST`, `PORT`, `MCP_HTTP_ENDPOINT` align with reverse proxy expectations (`/mcp` path); optional `FASTMCP_STATELESS=1` for stateless mode supporting scale-out workers.
- **OpenAI / ChatGPT integration**: connectors documented in `docs/CONNECTORS.md`; ensure TLS termination and `Authorization: Bearer <token>` headers managed at proxy layer.
- **Environment parity**: `.env` and `.env.example` mirror module requirements; secrets injected per environment through deployment platform (Render, Fly, Kubernetes, etc.).
- **Packaging**: `npm run build` generates `build/` artefacts for deployment; `package.json#bin` enables CLI or `npx` execution for local inspectors.

## 4. Additional Server & Module Integration Sequence

1. **Baseline FastMCP Core (Phase 1)** – wallet refactor, middleware wiring, prompts.
2. **BSC Module (Phase 2)** – BEP-20 transfers, provider management.
3. **Wormhole Bridge (Phase 3)** – cross-chain orchestration, progress reporting.
4. **Data Intelligence (Phase 4)** – DeBank, CryptoPanic, Web3 Research, Crypto Projects.
5. **Solana PumpSwap (Phase 5)** – Jupiter integrations with caching + schema normalization.
6. **DeFi & Aave Analytics (Phase 6)** – integrated aggregator + Aave graph tooling with caching, prompts, and Jest coverage.
7. **External Expansions** – evaluate `external/` MCP servers (getAlby, additional trading desks) for harmonised schema & middleware adoption before consolidation.

All modules adhere to shared Zod schema helpers and tool result normalization, ensuring consistent outputs for downstream LLM agents.

## 5. Verification, Telemetry & Rollout Checkpoints

- **Quality gates**: `npm run lint`, `npm run test`, and `npm run build` required before merging or releasing.
- **Telemetry**: monitor FastMCP structured logs (Pino) for tool invocations, durations, and errors; forward logs to central observability stack (e.g., Loki, Datadog).
- **Integration tests**: run OpenAI Responses API smoke test (see `docs/CONNECTORS.md`) per release candidate.
- **Rollout strategy**:
  1. Deploy to staging with dedicated API keys; validate ChatGPT Developer Mode handshake and tool invocation.
  2. Enable cache and middleware metrics; capture baseline latency & error rates.
  3. Canary release to limited production seats; monitor for regressions.
  4. Promote to full production once telemetry remains stable for 24h.
- **Post-release**: update `production-ready-checklist.md` statuses and append changelog entries for traceability.

---

_Last updated: 2025-11-17_
