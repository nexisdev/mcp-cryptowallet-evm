# MCP SaaS Production Checklist  
_For multi-tenant, tiered usage (Free / Pro / Ultra) with OpenAI MCP compatibility_

## 1. Core Architecture & Environment

- [ ] MCP server is deployed as a stateless service (horizontally scalable).
- [x] Server binds to `0.0.0.0` and listens on the platform-provided `PORT` environment variable.
- [ ] All external access is via a single HTTPS endpoint (for example: `https://mcp.nex-t1.ai`).
- [ ] Reverse proxy / gateway (NGINX, API Gateway, etc.) is in front of the MCP service.
- [ ] WebSockets are supported and correctly forwarded through any proxy/load balancer.
- [ ] Infrastructure-as-code (Terraform, Pulumi, etc.) defines networking, scaling, and environment configuration.
- [ ] Separate environments for `dev`, `staging`, and `production` with isolated resources and secrets.


## 2. OpenAI MCP Compatibility

- [ ] MCP endpoint is publicly reachable over HTTPS with a `wss://` WebSocket upgrade.
- [ ] Server accepts WebSocket upgrade and returns `101 Switching Protocols`.
- [ ] On connection, server sends a valid MCP handshake (`hello` with protocol and version).
- [ ] Server implements MCP request types: `initialize`, `list_tools`, `call_tool` (and others as needed).
- [ ] `list_tools` returns a valid list of tools with `name`, `description`, and `inputSchema` in JSON Schema format.
- [ ] All MCP messages are valid JSON and conform to the required schema (including `id` on responses to requests).
- [ ] MCP server does not return HTML or redirects on WebSocket connections.
- [ ] Authentication scheme (if any) for MCP is compatible with OpenAI (for example, Bearer token in configuration).
- [ ] Server remains connected for long-lived sessions and does not prematurely close idle MCP connections.


## 3. Multi-Tenant, Multi-User, Organization Model

- [ ] Data model supports users, organizations, and membership relationships:
  - [ ] User entity
  - [ ] Organization entity
  - [ ] User ↔ Organization membership with roles (owner, admin, member)
- [ ] Each incoming request is associated with:
  - [ ] Authenticated user identity
  - [ ] Organization context (if applicable)
  - [ ] Usage plan / tier (Free, Pro, Ultra)
- [ ] All data access is scoped by tenant (organization or user) and enforced in code and database queries.
- [ ] No cross-tenant data leakage (row-level security or equivalent checks in all access paths).
- [ ] Admin tools exist to view and manage users, organizations, and plan assignments.


## 4. Plan & Tier Definitions (Free / Pro / Ultra)

- [ ] Define clear, explicit limits per tier:

  - [ ] Free:
    - [ ] Max queries per day per user (for example: 100)
    - [ ] Max queries per minute per user (for example: 5)
    - [ ] Max concurrent requests per user (for example: 2)
    - [ ] Limited tools / endpoints access list defined
  - [ ] Pro:
    - [ ] Higher max queries per day per user (for example: 5,000)
    - [ ] Higher max queries per minute per user (for example: 20)
    - [ ] Max concurrent requests per user (for example: 5)
    - [ ] Access to more tools and advanced endpoints defined
  - [ ] Ultra:
    - [ ] Highest max queries per day per user (for example: 50,000)
    - [ ] Highest max queries per minute per user (for example: 50)
    - [ ] Max concurrent requests per user (for example: 10)
    - [ ] Access to all tools and premium features defined

- [ ] Define organization-level aggregate limits (per org per day / per minute) that cap combined user usage.
- [ ] Define global safety limits per tier to protect the platform (global Free pool, global Pro pool, etc.).
- [ ] All limits are stored in configuration (database or config service), not hard-coded in application logic.
- [ ] Behavior when limits are exceeded is defined per tier (for example: soft warnings, hard block, upgrade prompts).
- [ ] Plan upgrade and downgrade flows are fully specified and implemented (including immediate or next-billing-cycle behavior).


## 5. Authentication, Authorization, and API Access Points

- [ ] API keys or tokens are required for programmatic access (including MCP).
- [ ] Each API key is associated with:
  - [ ] User
  - [ ] Organization
  - [ ] Plan/tier
- [ ] Secure storage of API keys (hashed at rest or stored in a secrets manager).
- [ ] Token format defined (for example: random opaque string, not JWT, or signed JWT with clear claims).
- [ ] Authentication middleware validates the token on every request or WebSocket connection.
- [ ] Authorization layer enforces:
  - [ ] User permissions (role-based access control per organization)
  - [ ] Endpoint access based on tier (for example, Ultra-only tools)
- [ ] Separate access points (URLs or scopes) for:
  - [ ] Public documentation / dashboards
  - [ ] User API / MCP usage
  - [ ] Admin / internal tools
- [ ] Proper error codes and messages for unauthenticated (401) and unauthorized (403) access.


## 6. Rate Limiting Design

- [ ] Rate limiting is enforced at the API gateway or middleware layer before heavy computation.
- [ ] Rate limiting is implemented using a shared, low-latency store (for example: Redis).
- [ ] Rate limits are defined at multiple levels:
  - [ ] Per user
  - [ ] Per organization
  - [ ] Per API key
  - [ ] Per IP (as a safety / abuse fallback)
- [ ] Rate limits differ per tier (Free / Pro / Ultra) and are configurable.
- [ ] Algorithms selected and implemented:
  - [ ] Token bucket or leaky bucket for steady throughput
  - [ ] Fixed window or sliding window for simple burst control
- [ ] Rate limit keys include:
  - [ ] Identifier (user ID, org ID, API key)
  - [ ] Tier
  - [ ] Time window
- [ ] Rate limiting happens per endpoint group:
  - [ ] Core MCP tools
  - [ ] Expensive tools (for example: cross-chain, analytics) may have stricter limits
- [ ] When a rate limit is hit:
  - [ ] HTTP 429 (or MCP-style error) is returned with clear message and retry-after hint.
  - [ ] Event is logged with user/tier context.
- [ ] System includes global circuit breakers for extreme load situations.


## 7. Usage Quotas, Accounting, and Billing Integration

- [ ] Daily, monthly, or per-billing-period quotas are defined per tier and per org.
- [ ] Every successful request increments usage counters:
  - [ ] Per user
  - [ ] Per organization
  - [ ] Per tier and feature/tool
- [ ] Usage is persisted in a durable store (for example: database optimized for counters).
- [ ] Usage counters are updated in a transactionally safe way to avoid undercounting or double-counting.
- [ ] Background jobs aggregate fine-grained events into summarized usage for analytics and billing.
- [ ] Billing system or payment provider is integrated:
  - [ ] Plan subscription
  - [ ] Prorations or overage handling (if supported)
- [ ] Clear behavior when a quota is exhausted:
  - [ ] Free tier: hard stop with upgrade prompt.
  - [ ] Pro / Ultra: configurable overage policy (block, soft limit, or metered overage).
- [ ] Admin dashboard or internal tools let operators view usage by:
  - [ ] User
  - [ ] Organization
  - [ ] Tier
  - [ ] Tool / endpoint


## 8. Caching Strategy

- [ ] Caching scope is defined:
  - [ ] Per user or per organization for sensitive results.
  - [x] Globally shared for safe, deterministic, non-sensitive results.
- [ ] Cache keys are deterministic and include:
  - [x] Tool name
  - [x] Input parameters (normalized)
  - [x] User/org ID where required
  - [ ] Tier where behavior differs by plan
- [ ] Cache store chosen (for example: Redis) with defined TTLs per tier:
  - [ ] Free: longer cache TTLs to reduce cost.
  - [ ] Pro: moderate TTLs, with more fresh results.
  - [ ] Ultra: shorter TTLs or optional cache bypass for real-time needs.
- [ ] Cache invalidation rules exist for user-specific or stateful operations.
- [x] Cache is checked before invoking expensive operations (for example: external API calls, blockchain, LLM).
- [ ] Fail-safe behavior is in place if cache store is unavailable (system remains functional with degraded performance).
- [ ] Monitoring tracks cache hit rate, miss rate, and eviction behavior.


## 9. Observability, Logging, and Monitoring

- [x] Structured logging is enabled (JSON logs with request IDs, user IDs, org IDs, tier, tool name).
- [x] Logs exclude sensitive data (no secrets, passwords, or raw tokens).
- [x] Dedicated status server exposes `/health`, `/status`, and `/uptime` with queue depth and dependency metrics.
- [x] FastAPI companion service provides Swagger/OpenAPI documentation for status endpoints.
- [ ] Metrics collected:
  - [ ] Requests per second by tier, user, organization, tool.
  - [ ] Error rates by endpoint and tier.
  - [ ] Rate limit hits and quota exhaust events.
  - [ ] Latency percentiles (p50, p95, p99).
- [ ] Tracing is enabled (distributed tracing across gateway, MCP server, and downstream services).
- [ ] Dashboards for:
  - [ ] Overall system health.
  - [ ] Tier-based performance and usage.
  - [ ] OpenAI MCP connection success/failure rates.
- [x] External monitors (AWS ALB, UptimeRobot) are wired to `/health` and `/status` endpoints with alerting.
- [ ] Alerts configured for:
  - [ ] Elevated error rates or timeouts.
  - [ ] Surge in rate limit hits.
  - [ ] Sudden spikes in usage that might indicate abuse.
  - [ ] MCP-specific connection or handshake failures.


## 10. Security and Compliance Basics

- [ ] All external traffic uses HTTPS/TLS; no plain HTTP endpoints exposed.
- [ ] Secrets (API keys, database passwords, OpenAI keys) are stored in a secrets manager or encrypted environment variables.
- [ ] Access controls for admin tools are restricted to staff and audited.
- [ ] Logs and metrics access is restricted and audited.
- [ ] Data isolation between organizations is enforced and tested.
- [ ] Regular security reviews and dependency vulnerability scans are part of the CI/CD pipeline.
- [ ] Backup and restore procedures are defined, tested, and documented.
- [ ] Compliance-relevant policies (for example, data retention, deletion, and export) are defined and implemented.


## 11. Reliability, Scaling, and Failover

- [ ] Autoscaling rules are configured for peak load per tier.
- [ ] Readiness and liveness probes are configured for MCP services.
- [ ] Graceful shutdown and connection draining are implemented (especially for WebSockets).
- [ ] Blue/green or canary deployments are used for production changes.
- [ ] Rollback procedures are documented and easy to execute.
- [ ] Disaster recovery scenarios are identified and rehearsed.



## 12. OpenAI Client Integration and Testing

- [ ] Example OpenAI MCP client configuration is maintained and tested for all tiers.
- [ ] Automated tests verify:
  - [ ] Successful MCP handshake.
  - [ ] Tool discovery and invocation.
  - [ ] Correct handling of rate limit and quota errors.
- [ ] Load tests simulate concurrent Free, Pro, and Ultra usage patterns.
- [ ] Documentation is available for customers explaining:
  - [ ] How to connect via OpenAI MCP.
  - [ ] What limits apply to each tier.
  - [ ] How to interpret rate limit / quota errors and how to upgrade.
