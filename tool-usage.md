# Tool Usage Inventory

This inventory covers every FastMCP tool currently registered by `src/createServer.ts`. Use it when mapping connectors or validating MCP manifests.

## Runtime Enhancements (v2.1.0)

- **Structured logging**: all tools emit JSON logs through Pino with secret redaction. Control via `LOG_LEVEL` and `LOG_PRETTY`.
- **Shared storage**: FastMCP sessions persist usage and per-module configuration in Redis when `REDIS_URL` is provided; otherwise an in-memory store is used for development.
- **Authentication tiers**: bearer tokens parsed from `MCP_API_TOKENS` determine `tier`, `userId`, and `organizationId` injected into tool context for telemetry and policy enforcement.
- **Middleware stack**: telemetry, usage metrics, progress reporting, and error boundaries wrap every tool by default.

## Remote MCP Integrations (Kukapay Catalog)

The server can now proxy additional Kukapay MCP servers via FastMCP composition. Enable any integration by exporting the matching environment variables before launch:

| Repo | Env Prefix | Tool Prefix | Notes |
| --- | --- | --- | --- |
| `findblock-mcp` | `FINDBLOCK_MCP` | `findblock_*` | Block lookup by timestamp and RPC routing. |
| `pumpfun-wallets-mcp` | `PUMPFUN_WALLETS_MCP` | `pumpfun_*` | Pump.fun wallet analytics (requires `DUNE_API_KEY`). |
| `honeypot-detector-mcp` | `HONEYPOT_DETECTOR_MCP` | `honeypot_*` | Token risk analysis and honeypot detection. |
| `ens-mcp` | `ENS_MCP` | `ens_*` | ENS resolution, reverse lookups, metadata. |
| `chainlist-mcp` | `CHAINLIST_MCP` | `chainlist_*` | EVM chain catalogue and RPC discovery. |
| `rug-check-mcp` | `RUG_CHECK_MCP` | `rugcheck_*` | RugCheck token audits and safety scores. |
| `nft-analytics-mcp` | `NFT_ANALYTICS_MCP` | `nftanalytics_*` | NFT floor price and collection stats. |
| `crypto-projects-mcp` | `CRYPTO_PROJECTS_MCP` | `cproj_*` | Advanced DefiLlama protocol analytics (remote variant). |
| `solana-launchpads-mcp` | `SOLANA_LAUNCHPADS_MCP` | `launchpads_*` | Solana launchpad discovery and filtering. |
| `memecoin-radar-mcp` | `MEMECOIN_RADAR_MCP` | `memecoin_*` | Trending memecoin scouting with sentiment signals. |
| `crypto-whitepapers-mcp` | `CRYPTO_WHITEPAPERS_MCP` | `whitepapers_*` | Whitepaper search and PDF retrieval as resources. |
| `token-minter-mcp` | `TOKEN_MINTER_MCP` | `tokenminter_*` | Guided ERC20/ERC721 deployment flows. |
| `whattimeisit-mcp` | `WHATTIMEISIT_MCP` | `clock_*` | Multi-timezone utilities and scheduling helpers. |
| `nearby-search-mcp` | `NEARBY_SEARCH_MCP` | `nearby_*` | Location-based search using configured Maps API keys. |

Set `<PREFIX>_HTTP_URL` (or `<PREFIX>_URL`) to the remote server endpoint, plus optional `<PREFIX>_AUTH_TOKEN` or `<PREFIX>_HEADERS` for authentication. Tools inherit tier enforcement through the global middleware stack and are discoverable via `list_tools` once enabled.
- **Observability endpoints**: `/health`, `/status`, and `/uptime` are now served from the status server (`STATUS_SERVER_*` env) with queue depth, session counts, and dependency probe data.
- **FastAPI layer**: optional companion service (`external/fastapi-layer`) republishes the observability data with Swagger/OpenAPI for REST monitoring clients.

## Session Prompts

| Prompt | Purpose |
| --- | --- |
| `wallet_transaction_confirmation` | Summarise an ETH transaction for human approval. |
| `wallet_troubleshooting_checklist` | Pre-flight checks when wallet operations fail. |
| `wormhole_bridge_briefing` | Bridge plan recap with Wormhole safety checklist. |
| `debank_portfolio_digest` | Portfolio digest highlighting net worth and exposure. |
| `aave_health_review` | Summarise Aave account health and mitigation options. |
| `defi_trade_plan` | Draft an execution checklist for aggregator-based swaps. |
| `alpha_nof1_system_prompt` | Expert trader system prompt proxied from Alpha Arena. |
| `alpha_nof1_user_prompt` | Market + account situational prompt for Alpha Arena. |
| `poly_analyze_market` | Template for analysing a Polymarket market by slug. |
| `hyperinfo_analyze_positions` | Guided review of Hyperliquid account positions. |
| `freq_analyze_trade` | Summarise Freqtrade metrics for a specific pair/timeframe. |
| `freq_trading_strategy` | Generate a next action recommendation for Freqtrade bots. |
| `whale_summarize_whale_activity` | Quick brief of Hyperliquid whale alerts. |

## Wallet Module (`wallet_*`, `provider_*`, `network_*`)

- **Setup**: call `wallet_provider_set` (RPC URL) or `wallet_from_private_key` / `wallet_from_mnemonic` to load credentials into session context.
- **Typical flow**: generate or import wallet → retrieve keys or phrase (`wallet_get_private_key`, `wallet_get_mnemonic`) → query balances (`wallet_get_balance`) → craft transactions (`wallet_populate_transaction`) → sign & send (`wallet_send_transaction`).
- **Security**: private key and mnemonic inputs remain session-scoped; logs redact any argument containing the substring `password`.

## BSC Module (`bsc_*`)

- **Provider configuration**: `bsc_provider_set` switches RPC per session.
- **Transfers**: use `bsc_transfer_native` for BNB and `bsc_transfer_token` for BEP-20 (requires token address + decimals).
- **Read-only**: `bsc_token_balance` is cache-enabled for 5 minutes to reduce RPC load.

## Wormhole Module (`wormhole_*`)

- **Bridge workflow**: `wormhole_bridge_token` orchestrates quote → transfer creation; expects `sourceChain`, `targetChain`, `token`, `amount`.
- **Monitoring**: `wormhole_route_status` and `wormhole_transfer_status` provide cached status lookups; `wormhole_supported_routes` enumerates capabilities.
- **Progress**: middleware emits 100% completion progress once tool concludes.

## DeBank Module (`debank_*`)

- **Authentication**: optional `DEBANK_API_KEY` header forwarded automatically.
- **Usage**: `debank_portfolio_overview` summarises positions; `debank_protocol_list` enumerates tracked protocols; responses cached for 60 seconds.

## DeFi Aggregator Module (`defi_*`)

- **Provider config**: `defi_provider_set` stores aggregator base URL and CoinGecko API key in session storage; useful when targeting self-hosted routers.
- **Quoting**: `defi_swap_price` previews output amounts, while `defi_swap_quote` returns executable calldata for on-chain submission.
- **Discovery**: `defi_supported_chains`, `defi_liquidity_sources`, and `defi_supported_dexes` catalogue available liquidity venues across networks; responses cached 1–5 minutes depending on scope.
- **Analytics**: `defi_token_price`, `defi_trending_pools`, and `defi_coingecko_networks` expose CoinGecko onchain insights; conversions between wei and display units handled by `defi_convert_wei_to_unit` / `defi_convert_unit_to_wei`.

## CryptoPanic Module (`cryptopanic_*`)

- **Feed retrieval**: `cryptopanic_latest_news` accepts `kind`, `currencies`, `regions`; results cached for 90 seconds.
- **API tokens**: include `CRYPTOPANIC_API_KEY` for premium feeds.

## Web3 Research Module (`web3research_*`)

- **Asset discovery**: `web3research_search_assets` accepts search terms; `web3research_asset_details` fetches metrics; `web3research_trending` lists trending assets with cached responses.
- **Endpoints**: defaults to CoinGecko but configurable via `WEB3RESEARCH_ENDPOINT`.

## Crypto Projects Module (`cryptoprojects_*`)

- **Protocol analytics**: `cryptoprojects_protocol_details` returns structured JSON; `cryptoprojects_top_protocols` lists leaders by TVL.
- **Caching**: responses shared for 2 minutes to reduce DefiLlama calls.

## PumpSwap Module (`pumpswap_*`)

- **Token discovery**: `pumpswap_token_info` fetches metadata; `pumpswap_price` and `pumpswap_quote` provide Jupiter price/quote data.
- **Configuration**: override default endpoints or slippage via environment variables documented in `README.md`.

## Aave Module (`aave_*`)

- **Provider config**: `aave_provider_set` customises subgraph endpoint/API key per session; defaults fall back to official Aave graph with optional `THEGRAPH_API_KEY`.
- **Reserve insights**: `aave_reserves_overview` and `aave_analyze_liquidity` summarise liquidity, borrow rates, and utilisation for top markets.
- **User posture**: `aave_user_positions` and `aave_user_health` query collateral/borrow balances and health factors, aiding liquidation monitoring.
- **Namespace visibility**: `aave_namespace_info` documents storage layout for debugging multi-session behaviour.

## Aster Module (`aster_*`)

- **Market coverage**: wraps Aster Finance futures REST endpoints for candlesticks, order books, and trade feeds.
- **Latency**: responses cached between 5–30 seconds depending on tool to reduce upstream load.
- **Configuration**: use `ASTER_BASE_URL` to point at alternative clusters or staging environments.

## Remote MCP Proxy Modules

These modules are dynamically populated from external MCP servers via HTTP Stream. Provide the corresponding `*_MCP_HTTP_URL` (and optional auth headers/tokens) before startup; otherwise the proxy skips registration and records a warning.

### Alpha Arena (`alpha_*`)
- **Endpoint**: `ALPHA_ARENA_MCP_HTTP_URL` (Streamable HTTP) with optional `ALPHA_ARENA_MCP_AUTH_TOKEN` or `ALPHA_ARENA_MCP_HEADERS`.
- **Trading stack**: `alpha_place_order`, `alpha_close_position`, `alpha_cancel_open_orders`, `alpha_account_info`, `alpha_market_state`.
- **Prompts**: `alpha_nof1_system_prompt`, `alpha_nof1_user_prompt` forward the remote nof1 persona templates.
- **Notes**: Designed for Hyperliquid perps; consider read-only API keys for dry runs.

### DEX Pools (`dex_*`)
- **Endpoint**: `DEX_POOLS_MCP_HTTP_URL`; supply CoinGecko headers if required.
- **Discovery tools**: `dex_get_supported_networks`, `dex_get_supported_dexes_by_network`, `dex_get_new_pools`, `dex_get_new_pools_by_network`, `dex_get_pool_details`.
- **Analytics**: trending/top pool variants (`dex_get_trending_*`, `dex_get_top_*`) plus `dex_search_pools`.
- **Usage**: Ideal for surfacing liquidity candidates to DeFi strategy prompts.

### Polymarket Predictions (`poly_*`)
- **Endpoint**: `POLYMARKET_PREDICTIONS_MCP_HTTP_URL`.
- **Tools**: `poly_search_events`, `poly_get_events`, `poly_get_markets`.
- **Prompts**: `poly_analyze_market` delivers a structured analyst brief for a specified market slug.

### Hyperliquid Info (`hyperinfo_*`)
- **Endpoint**: `HYPERLIQUID_INFO_MCP_HTTP_URL`.
- **Account coverage**: state, open orders, trade/funding history, staking, orders by OID/CLOID.
- **Market data**: `hyperinfo_get_all_mids`, `hyperinfo_get_l2_snapshot`, `hyperinfo_get_candles_snapshot`, metadata endpoints.
- **Prompt**: `hyperinfo_analyze_positions` composes a holistic position review.

### Freqtrade Control (`freq_*`)
- **Endpoint**: `FREQTRADE_MCP_HTTP_URL` pointing at the bot’s REST driver.
- **Operations**: status/profit/balance fetchers, whitelist/blacklist builders, trade placement, bot lifecycle.
- **Prompts**: `freq_analyze_trade`, `freq_trading_strategy` condense bot telemetry into next-action guidance.
- **Security**: ensure `ALLOWED_IPS` is configured on the Freqtrade side; the proxy simply forwards.

### Hyperliquid Whale Alert (`whale_*`)
- **Endpoint**: `HYPERLIQUID_WHALEALERT_MCP_HTTP_URL`.
- **Tools**: `whale_get_whale_alerts` streams recent large-order activity; prompt `whale_summarize_whale_activity` produces a digest.
- **Cadence**: data surfaces aggregated in 5-minute buckets; treat as near-real-time.

### Wallet Inspector (`inspector_*`)
- **Endpoint**: `WALLET_INSPECTOR_MCP_HTTP_URL`.
- **Analytics**: `inspector_get_wallet_balance`, `inspector_get_wallet_activity`, `inspector_get_wallet_transactions`.
- **Typical flow**: pair with local wallet module to reconcile on-chain activity with custodial state.

### Ethereum Validators Queue (`validators_*`)
- **Status**: Repository `kukapay/ethereum-validators-queue-mcp` is currently unavailable, so proxy registration is skipped by default. Environment keys remain reserved (`ETHEREUM_VALIDATORS_QUEUE_MCP_HTTP_URL`) for future enablement.

---

Tests covering each module live under `tests/modules/*`, with fetch mocks illustrating expected payloads and output normalization.
## Wallet Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `wallet_provider_set` | Configure primary RPC endpoint for wallet interactions. | `{"providerURL":"https://eth.llamarpc.com"}` |
| `wallet_create_random` | Generate new random wallet, optionally encrypt with password. | `{"password":"s3cret"}` |
| `wallet_from_private_key` | Import wallet from raw private key. | `{"privateKey":"0xabc123..."}` |
| `wallet_create_mnemonic_phrase` | Create a BIP-39 mnemonic phrase. | `{"length":24}` |
| `wallet_from_mnemonic` | Load wallet from mnemonic phrase (and optional derivation path). | `{"mnemonic":"seed words...", "path":"m/44'/60'/0'/0/0"}` |
| `wallet_from_encrypted_json` | Decrypt encrypted JSON keystore to active wallet. | `{"json":"{...}", "password":"s3cret"}` |
| `wallet_encrypt` | Encrypt active wallet with password. | `{"password":"vault-pass"}` |
| `wallet_get_address` | Return active wallet address. | `{}` |
| `wallet_get_public_key` | Return public key for active wallet. | `{}` |
| `wallet_get_private_key` | Reveal private key (requires password if encrypted). | `{"password":"s3cret"}` |
| `wallet_get_balance` | Fetch ETH balance for active wallet (supports block tag). | `{"blockTag":"latest"}` |
| `wallet_get_chain_id` | Get connected chain ID. | `{}` |
| `wallet_get_gas_price` | Get current gas price from provider. | `{}` |
| `wallet_get_transaction_count` | Retrieve nonce for wallet (supports block tag). | `{"blockTag":"pending"}` |
| `wallet_call` | Perform read-only contract call using wallet signer. | `{"to":"0xContract","data":"0x..."}` |
| `wallet_send_transaction` | Send signed transaction via wallet signer. | `{"to":"0xRecipient","value":"0.1"}` |
| `wallet_sign_transaction` | Sign transaction without broadcasting. | `{"to":"0xRecipient","value":"1"}` |
| `wallet_populate_transaction` | Populate gas, nonce, etc. for transaction. | `{"to":"0xRecipient","value":"0.05"}` |
| `wallet_sign_message` | Sign arbitrary text message. | `{"message":"hello"}` |
| `wallet_sign_typed_data` | Sign EIP-712 typed data payload. | `{"domain":{...},"types":{...},"message":{...}}` |
| `wallet_verify_message` | Verify signature against address. | `{"message":"hello","signature":"0x...","address":"0x..."}` |
| `wallet_verify_typed_data` | Verify EIP-712 signature. | `{"domain":{...},"types":{...},"message":{...},"signature":"0x..."}` |
| `provider_get_block` | Fetch block details from provider. | `{"blockTag":"latest"}` |
| `provider_get_transaction` | Fetch transaction by hash. | `{"hash":"0x..."}` |
| `provider_get_transaction_receipt` | Fetch receipt by hash. | `{"hash":"0x..."}` |
| `provider_get_code` | Retrieve deployed bytecode at address. | `{"address":"0xContract"}` |
| `provider_get_storage_at` | Read storage slot value. | `{"address":"0xContract","position":"0x0"}` |
| `provider_estimate_gas` | Estimate gas for transaction call. | `{"to":"0xContract","data":"0x..."}` |
| `provider_get_logs` | Query logs by topics + block range. | `{"address":"0xContract","fromBlock":"0x1","toBlock":"latest","topics":[]}` |
| `provider_get_ens_resolver` | Resolve ENS resolver details. | `{"name":"vitalik.eth"}` |
| `provider_lookup_address` | Reverse ENS lookup for address. | `{"address":"0x..."}` |
| `provider_resolve_name` | Resolve ENS name to address. | `{"name":"vitalik.eth"}` |
| `network_get_network` | Describe connected network metadata. | `{}` |
| `network_get_block_number` | Get latest block number. | `{}` |
| `network_get_fee_data` | Get maxFeePerGas / maxPriorityFeePerGas suggestions. | `{}` |

## BSC Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `bsc_provider_set` | Configure BSC RPC endpoint. | `{"providerURL":"https://bsc-dataseed.binance.org"}` |
| `bsc_transfer_native` | Send BNB to recipient. | `{"to":"0xRecipient","value":"0.2"}` |
| `bsc_transfer_token` | Transfer BEP-20 token. | `{"token":"0xToken","to":"0xRecipient","amount":"100","decimals":18}` |
| `bsc_token_balance` | Fetch BEP-20 balance for address. | `{"token":"0xToken","address":"0xWallet","decimals":18}` |

## Wormhole Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `wormhole_provider_set` | Configure Wormhole API endpoint & auth. | `{"endpoint":"https://api.wormhole.com","apiKey":"..."}` |
| `wormhole_bridge_token` | Initiate bridge transfer. | `{"sourceChain":"ethereum","targetChain":"base","token":"USDC","amount":"100"}` |
| `wormhole_route_status` | Query route health / ETA. | `{"sourceChain":"ethereum","targetChain":"base"}` |
| `wormhole_supported_routes` | List available routes for configured endpoint. | `{}` |
| `wormhole_transfer_status` | Check status of bridge transfer. | `{"transferId":"bridge-uuid"}` |
| `wormhole_supported_chains` | Enumerate chains supported by current server build. | `{}` |

## DeBank Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `debank_provider_set` | Configure DeBank API endpoint & key. | `{"endpoint":"https://openapi.debank.com","apiKey":"..."}` |
| `debank_user_total_balance` | Fetch wallet USD net worth. | `{"address":"0xWallet"}` |
| `debank_user_tokens` | List token holdings with balances. | `{"address":"0xWallet"}` |
| `debank_user_protocols` | List DeFi protocol exposure. | `{"address":"0xWallet"}` |
| `debank_token_info` | Fetch token metadata & price stats. | `{"chainId":"eth","tokenAddress":"0xToken"}` |

## CryptoPanic Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `cryptopanic_provider_set` | Configure CryptoPanic endpoint & token. | `{"endpoint":"https://cryptopanic.com","apiKey":"..."}` |
| `cryptopanic_latest_news` | Fetch latest news posts (supports filters). | `{"kind":"news","currencies":["BTC","ETH"]}` |

## Alpha Arena Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `alpha_place_order` | Submit Hyperliquid orders with optional TP/SL autocalculation. | `{"symbol":"BTC/USDC:USDC","side":"buy","size":0.05,"leverage":8}` |
| `alpha_close_position` | Close all open positions for a trading pair. | `{"symbol":"BTC/USDC:USDC"}` |
| `alpha_cancel_open_orders` | Cancel every open order for the symbol. | `{"symbol":"BTC/USDC:USDC"}` |
| `alpha_account_info` | Retrieve formatted account equity, positions, and PnL. | `{}` |
| `alpha_market_state` | Fetch OHLCV + indicator bundle for a symbol. | `{"symbol":"ETH/USDC:USDC"}` |

## DEX Pools Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `dex_get_supported_networks` | List GeckoTerminal-supported networks. | `{}` |
| `dex_get_supported_dexes_by_network` | Enumerate DEX venues for a network. | `{"network":"eth"}` |
| `dex_get_new_pools` | Latest pools across all networks. | `{"page":1}` |
| `dex_get_new_pools_by_network` | Latest pools for a single network. | `{"network":"base"}` |
| `dex_get_pool_details` | Detailed liquidity metrics for a pool. | `{"network":"eth","pool_address":"0x..."}` |
| `dex_get_trending_pools` | Trending pools for the selected duration. | `{"duration":"1h"}` |
| `dex_get_trending_pools_by_network` | Trending pools scoped to a network. | `{"network":"bsc","duration":"24h"}` |
| `dex_get_top_pools_by_network` | Top pools ranked by volume or tx count. | `{"network":"polygon","sort":"h24_volume_usd_desc"}` |
| `dex_get_top_pools_by_dex` | Leaderboard for a specific DEX on a network. | `{"network":"eth","dex":"uniswap_v3"}` |
| `dex_search_pools` | Search pools by token symbol/name. | `{"network":"eth","query":"weth"}` |

## Polymarket Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `poly_search_events` | Search Polymarket events via `/public-search`. | `{"q":"bitcoin","events_status":"active"}` |
| `poly_get_events` | Fetch events with markets and volumes. | `{"limit":5,"order":"volume"}` |
| `poly_get_markets` | Retrieve markets, outcomes, and prices. | `{"slug":["us-presidential-election-2024"]}` |

## Hyperliquid Info Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `hyperinfo_get_user_state` | User positions, margin, withdrawable balances. | `{"account_address":"0xabc...","check_spot":false}` |
| `hyperinfo_get_user_open_orders` | List all open orders for account. | `{"account_address":"0xabc..."}` |
| `hyperinfo_get_all_mids` | Mid-price snapshot for all pairs. | `{}` |
| `hyperinfo_get_user_trade_history` | Recent fills for account. | `{"account_address":"0xabc..."}` |
| `hyperinfo_get_perp_dexs` | Perpetual market metadata. | `{}` |
| `hyperinfo_get_coin_funding_history` | Funding history for a coin within a range. | `{"coin_name":"BTC","start_time":"2025-01-01T00:00:00Z","end_time":"2025-01-02T00:00:00Z"}` |
| `hyperinfo_get_user_funding_history` | Funding payments per account. | `{"account_address":"0xabc...","start_time":"2025-01-01T00:00:00Z","end_time":"2025-01-07T00:00:00Z"}` |
| `hyperinfo_get_l2_snapshot` | L2 order book snapshot. | `{"coin_name":"ETH"}` |
| `hyperinfo_get_candles_snapshot` | OHLCV candles for interval/time range. | `{"coin_name":"SOL","interval":"5m","start_time":"2025-01-01T00:00:00Z","end_time":"2025-01-01T12:00:00Z"}` |
| `hyperinfo_get_user_fees` | Maker/taker fee tiers for account. | `{"account_address":"0xabc..."}` |
| `hyperinfo_get_user_staking_summary` | Hyperliquid staking summary. | `{"account_address":"0xabc..."}` |
| `hyperinfo_get_user_staking_rewards` | Historical staking rewards. | `{"account_address":"0xabc..."}` |
| `hyperinfo_get_user_order_by_oid` | Order detail by numeric order ID. | `{"account_address":"0xabc...","oid":123456}` |
| `hyperinfo_get_user_order_by_cloid` | Order detail by client order ID. | `{"account_address":"0xabc...","cloid":"alpha-1"}` |
| `hyperinfo_get_user_sub_accounts` | Enumerate sub-accounts tied to root. | `{"account_address":"0xabc..."}` |
| `hyperinfo_get_perp_metadata` | Perp metadata with optional asset contexts. | `{"include_asset_ctxs":true}` |
| `hyperinfo_get_spot_metadata` | Spot metadata with optional asset contexts. | `{"include_asset_ctxs":false}` |

## Freqtrade Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `freq_fetch_market_data` | Candle data for a pair/timeframe. | `{"pair":"BTC/USDT","timeframe":"5m"}` |
| `freq_fetch_bot_status` | High-level bot status (state, uptime). | `{}` |
| `freq_fetch_profit` | Aggregated profit statistics. | `{}` |
| `freq_fetch_balance` | Wallet balances tracked by Freqtrade. | `{}` |
| `freq_fetch_performance` | Strategy performance summary. | `{}` |
| `freq_fetch_whitelist` | Current trading whitelist. | `{}` |
| `freq_fetch_blacklist` | Current blacklist. | `{}` |
| `freq_fetch_trades` | Recent executed trades. | `{}` |
| `freq_fetch_config` | Active configuration snapshot. | `{}` |
| `freq_fetch_locks` | View slot/price locks applied by bot. | `{}` |
| `freq_place_trade` | Submit a manual trade via bot. | `{"pair":"ETH/USDT","side":"buy","stake_amount":100}` |
| `freq_start_bot` | Start the Freqtrade process. | `{}` |
| `freq_stop_bot` | Stop the Freqtrade process. | `{}` |
| `freq_reload_config` | Reload configuration without restart. | `{}` |
| `freq_add_blacklist` | Add pair to blacklist. | `{"pair":"PEPE/USDT"}` |
| `freq_delete_blacklist` | Remove pair from blacklist. | `{"pair":"PEPE/USDT"}` |
| `freq_delete_lock` | Remove an existing lock by id. | `{"lock_id":42}` |

## Hyperliquid Whale Alert Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `whale_get_whale_alerts` | Retrieve aggregated whale alerts for Hyperliquid. | `{}` |

## Wallet Inspector Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `inspector_get_wallet_balance` | Balances per token for an address. | `{"wallet_address":"0xabc..."}` |
| `inspector_get_wallet_activity` | Summary of recent activity (counts, protocols). | `{"wallet_address":"0xabc..."}` |
| `inspector_get_wallet_transactions` | Fetch latest transactions with pagination. | `{"wallet_address":"0xabc...","limit":50}` |

## Web3Research Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `web3research_provider_set` | Configure CoinGecko research endpoint. | `{"endpoint":"https://api.coingecko.com","apiKey":"..."}` |
| `web3research_search_assets` | Search assets by name/symbol. | `{"query":"solana"}` |
| `web3research_asset_details` | Detailed asset market data. | `{"id":"ethereum","currency":"usd"}` |
| `web3research_trending` | Trending assets snapshot. | `{}` |

## CryptoProjects Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `cryptoprojects_provider_set` | Configure DefiLlama analytics endpoint. | `{"endpoint":"https://api.llama.fi"}` |
| `cryptoprojects_protocol_details` | Retrieve protocol summary. | `{"slug":"aave"}` |
| `cryptoprojects_top_protocols` | List top protocols by TVL. | `{"limit":10}` |

## PumpSwap (Jupiter) Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `pumpswap_provider_set` | Configure Jupiter endpoints & default slippage. | `{"quoteEndpoint":"https://quote-api.jup.ag","defaultSlippageBps":50}` |
| `pumpswap_price` | Fetch USD price for Solana token. | `{"mint":"So11111111111111111111111111111111111111112"}` |
| `pumpswap_quote` | Get swap quote between Solana tokens. | `{"inputMint":"SoL","outputMint":"USDC","amount":"1000000"}` |
| `pumpswap_token_info` | Retrieve token metadata. | `{"mint":"So1111..."}` |

## Aster Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `aster_kline` | Get candlestick data for a symbol/interval. | `{"symbol":"BTCUSDT","interval":"1h","limit":100}` |
| `aster_order_book_ticker` | Fetch best bid/ask for a symbol (or all symbols). | `{"symbol":"ETHUSDT"}` |
| `aster_order_book` | Retrieve order book bids/asks for a symbol. | `{"symbol":"BTCUSDT","limit":50}` |
| `aster_recent_trades` | List recent trades for a symbol. | `{"symbol":"SOLUSDT","limit":20}` |

## Aave Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `aave_provider_set` | Override subgraph URL/API key for session. | `{"subgraphUrl":"https://gateway...","apiKey":"THEGRAPH_KEY"}` |
| `aave_provider_info` | Display active provider configuration. | `{}` |
| `aave_reserves_overview` | Summarise top reserve liquidity/borrow rates. | `{}` |
| `aave_analyze_liquidity` | Inspect single reserve metrics. | `{"symbol":"USDC"}` |
| `aave_user_positions` | List collateral & debt balances for address. | `{"userAddress":"0xWallet"}` |
| `aave_user_health` | Report health factor & risk summary. | `{"userAddress":"0xWallet"}` |
| `aave_namespace_info` | Explain storage namespace usage. | `{}` |

## DeFi Trading Module
| Tool | Purpose | Example Input |
| --- | --- | --- |
| `defi_provider_set` | Configure aggregator URL & CoinGecko API key. | `{"aggregatorUrl":"http://44.252.136.98","coinGeckoApiKey":"CG-..."}` |
| `defi_provider_info` | Inspect provider configuration. | `{}` |
| `defi_swap_price` | Fetch indicative swap pricing. | `{"chainId":1,"buyToken":"0xTokenB","sellToken":"0xTokenA","sellAmount":"1000000000000000000"}` |
| `defi_swap_quote` | Retrieve executable quote payload. | `{"chainId":1,"buyToken":"0xTokenB","sellToken":"0xTokenA","sellAmount":"1000000000000000000","slippageBps":100}` |
| `defi_supported_chains` | List aggregator-supported chains. | `{}` |
| `defi_liquidity_sources` | Enumerate DEX sources for chain. | `{"chainId":42161}` |
| `defi_token_price` | Query CoinGecko onchain token prices. | `{"network":"ethereum","addresses":"0xTokenA,0xTokenB","includeMarketCap":true}` |
| `defi_coingecko_networks` | Page through supported networks. | `{"page":1}` |
| `defi_supported_dexes` | List DEXes on network. | `{"network":"ethereum","page":1}` |
| `defi_trending_pools` | Fetch trending pools (optionally network scoped). | `{"duration":"24h"}` |
| `defi_convert_wei_to_unit` | Convert wei value to decimal units. | `{"amount":"1000000000000000000","decimals":18}` |
| `defi_convert_unit_to_wei` | Convert decimal amount to wei. | `{"amount":"1.23","decimals":18}` |

## DeFi News & Research Prompts
| Prompt | Purpose | Arguments |
| --- | --- | --- |
| `wallet_transaction_confirmation` | Summarise pending wallet transaction for user approval. | `to`, `value`, `network`, optional gas fields |
| `wallet_troubleshooting_checklist` | Provide wallet troubleshooting steps. | `scenario`, optional `network` |
| `wormhole_bridge_briefing` | Outline bridge plan with safety checklist. | `sourceChain`, `targetChain`, `token`, `amount` |
| `debank_portfolio_digest` | Summarise DeBank portfolio snapshot. | `address`, optional `netWorthUsd`, `topProtocols` |
| `aave_health_review` | Outline health factor analysis steps. | `address`, optional health stats |
| `defi_trade_plan` | Recommend swap execution plan using aggregator tools. | `chainId`, `sellToken`, `buyToken`, `sellAmount` |

## Storage & Middleware Behavior
- All tool executions apply telemetry, usage metrics, progress reporting, and error boundary middleware automatically.
- Response caching is applied to read-heavy tools (Wormhole status, DeBank queries, aggregator analytics) with module-specific TTLs.
- Session-scoped storage keys follow the pattern `<namespace>:<sessionId>:<key>` enabling per-session isolation.
