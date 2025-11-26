# FastMCP UI Capability Map (Nov 22, 2025)

This document translates the FastMCP server toolset into UI-ready flows so product teams can ship management consoles for creation, deployment, and agent ops. The server runs FastMCP `v2.1.0`, exposes stdio + HTTP Stream transports, and layers telemetry/progress middleware on every tool call.

## 1) Runtime Surfaces to Mirror in UI
- **Session-scoped provider config**: Almost every module has a `*_provider_set` tool; surface these first (RPC URL, API key, network/cluster) and persist per user/session.
- **Auth tiers**: `free`, `pro`, `ultra` govern access (e.g., `memedeploy_deploy_token` requires `pro`). Show gated badges + upsell hints.
- **Progress + logs**: Tools stream progress/status via FastMCP logging; add a live log panel and final structured payload viewer.
- **Caching hints**: Read-heavy tools advertise TTLs; show “cached” chips and offer a “refresh” action.

## 2) Creation & Deployment Flows (what to build)

### DAO Creation & Management (Solana)
- **Source tools**: `assetcli_*` remote pack (enable with `ASSETCLI_MCP_HTTP_URL`). Covers DAO initialization (integrated Squads multisig or standard), treasury funding, proposal lifecycle, bonding-curve launches, and Raydium migrations.
- **UI flow**:
  1) **Connect**: cluster selector, RPC health badge from `solrpc_*` (optional read-only helper).
  2) **Create DAO wizard**: fields for name, members, threshold, “integrated multisig?” toggle. On submit, call DAO init tool and show realm/governance/treasury addresses.
  3) **Treasury tab**: balances (SOL + SPL), “Fund DAO” (native/token) actions.
  4) **Proposals tab**: list, filter, detail view with instructions; include approve/execute buttons (multisig + governance).
  5) **Bonding curve launcher**: price curve params, liquidity targets, fee NFT mint output; show on-chain transaction signatures.
- **States to model**: pending (tx sent), finalized (sig confirmed), failed (RPC/authority errors), needs-wallet (no signer).

### Token Creation & Deployment
- **Solana memecoin (built-in)**: `memedeploy_deploy_token` (requires `THIRDWEB_SERVICE_KEY` + `MEMEDEPLOY_TOKEN_API_*`). Inputs: name, symbol, image URL, cluster (mainnet/devnet), “wait for completion” toggle. Output: token address, pool address, payer wallet, signature, deployment status.
- **EVM token minter (federated)**: `tokenminter_*` via `TOKEN_MINTER_MCP_HTTP_URL`. Expect ERC-20 deploy, mint, supply controls. Provide chain selector, supply/decimals, owner address, mint-to preview, and broadcast control.
- **Base AgentKit (federated)**: `base_*` includes wallet + ERC-20 helpers on Base L2; reuse token form with Base RPC prefilled.
- **UI flow**: pre-flight config check → form → “review & deploy” modal (gas + addresses) → live status timeline (pending → deployed → pool created).
- **Risks to message**: key custody (Thirdweb in-app wallet), API quota, slippage on auto-liquidity pools, cluster mismatch.

### NFT Creation & Deployment
- **Available surfaces**:
  - `base_*` (AgentKit) supports NFT mint/deploy when upstream keys are set.
  - `nftanalytics_*` (read-only) for post-deploy collection stats.
- **UI flow**: metadata composer (name, description, image URL), optional royalties, supply, chain selector; deploy collection → mint preview → per-mint receipt list. Add “View analytics” sidebar powered by `nftanalytics_*`.
- **Gaps**: No native Solana NFT minter in the current server; route users to Base/AgentKit or upcoming Solana launcher.

### Smart Contract Creation & Deployment
- **EVM raw deploy**: Use `wallet_populate_transaction` + `wallet_send_transaction` with contract bytecode; `provider_estimate_gas` for sizing; `provider_get_transaction_receipt` for confirmation.
- **Foundry toolchain (federated)**: `foundry_*` (enable `FOUNDRY_MCP_HTTP_URL`) for compile/test/deploy from source—ideal for a “Upload/Compile/Deploy” UX with logs.
- **Linea module**: `linea_*` for call/estimate/log queries on Linea; pair with wallet signing to deploy to L2.
- **Solana programs (planned)**: Schemas include `deployProgram`/`upgradeProgram`, but handlers are not wired; keep UI behind “Coming soon” if needed.
- **UI flow**: source/ABI upload → compile (foundry) → simulation (read-only call) → sign & send → receipt + contract address → verify/read panel (code, storage, events).

### Agent Transactions & Collaboration
- **Agent comms**: `agentcomm_*` (rooms, post, wait/stream) for multi-agent chat or approvals. UI: room list, message feed with long-polling spinner, “clear messages” action.
- **Execution primitives**: wallet (`wallet_*`, `bsc_*`, `linea_*`, `solana_*`), bridge (`wormhole_*`), swaps (`defi_*`, `pumpswap_*`), research (`omni_*`, `deepresearch_*`), alerts (`whale_*`, `rugcheck_*`, `honeypot_*`).
- **Pattern**: Let agents draft a transaction plan, run read-only checks (`readOnlyHint` tools), then surface a “request human approval” modal that replays the tool outputs.

## 3) Module Cheat Sheet (what to wire where)
- **Wallet (EVM)**: create/import wallets, view balances, build/sign/send tx, ENS resolve, EIP-712 signing. UI: wallet drawer + nonce/gas inspector.
- **BSC**: native + BEP-20 transfers, balance lookup. UI: chain switcher inherits provider_set.
- **Wormhole**: bridge quote/status/support matrix. UI: route picker with live status polling.
- **DeFi aggregator**: price/quote (incl. structured content), supported chains/dexes, token prices, trending pools, wei↔unit helpers. UI: swap builder + quote diff view.
- **Aave**: reserves overview, user positions/health, namespace info. UI: health gauge + liquidation warnings.
- **PumpSwap (Solana/Jupiter)**: price/quote/token info; supports custom slippage + endpoints. UI: Solana swap drawer.
- **Aster**: market data (kline, orderbook, ticker, trades). UI: compact market widget.
- **CryptoPanic / Web3Research / CryptoProjects**: news + asset/project intel. UI: right-rail insights cards.
- **Memedeploy**: Solana memecoin deploy with Thirdweb signer. UI: launchpad card with status timeline.
- **Remote packs**: Alpha Arena (perps), DEX Pools (liquidity), Polymarket, Hyperliquid info/whales, Freqtrade control, Wallet Inspector, ENS/Chainlist, OKX, Base, Orderbook, NFT analytics, Token minter, Foundry, AgentComm, OmniSearch/DeepResearch, Context7 docs, etc. Mirror enablement toggles to the presence of `*_MCP_HTTP_URL`.

## 4) UI Building Blocks to Reuse
- **Config banner**: Detect missing env (e.g., Thirdweb key, token API key) and block dangerous actions with inline guidance.
- **Network pill**: Show active chain/cluster + RPC latency; enable quick switch via provider_set presets.
- **Action composer**: Form + “Review” step + progress log + structured result viewer (JSON toggle) for every write tool.
- **Approval modal**: Human confirmation for any write (deploy, bridge, trade). Include parsed summary from `wallet_transaction_confirmation` prompt.
- **Status list**: Standard states (`draft → pending → in-flight → confirmed → failed`) with timestamps and tx hashes.
- **Analytics sidebars**: plug `inspector_*`, `nftanalytics_*`, `dex_*`, `hyperinfo_*` into contextual panels around wallets, pools, or collections.

## 5) Enablement Checklist (per environment)
- Set **MCP transport** (HTTP Stream recommended) and expose `/mcp` + `/health`.
- Load **remote connectors** by defining `*_MCP_HTTP_URL` (+ optional auth/header JSON). Missing envs simply skip registration—reflect that in the UI with a disabled state.
- Provide **tier defaults** via `MCP_DEFAULT_TIER`; enforce upgrade paths for `pro`-only actions (memedeploy, signing).
- Configure **Thirdweb + token API** for memecoin deployment, **Base API/seed** for Base AgentKit, **Foundry server URL** for contract toolchain, **AgentComm URL** for rooms.
- Wire **Redis** if you want cross-session persistence; otherwise sessions are in-memory (good for dev only).

## 6) Suggested Screens (minimal set)
1) **Onboarding**: choose network stack (EVM / Solana / Base) → provider config → key management.
2) **Launchpad**: tabs for Token, NFT, DAO, Contract; each with form → review → deploy timeline.
3) **Transactions**: queue view of pending/confirmed tx with filters (wallet, chain, module).
4) **Research & Risk**: news (CryptoPanic), search (Omni), risk checks (Rugcheck/Honeypot), wallet intelligence (Inspector).
5) **Agent Rooms**: collaborative chat + action replay + quick buttons to approve/send transactions.

Keep components thin: the server already normalizes outputs and emits progress. Favor clear, stateful UI wrappers over bespoke logic. Once the UI is wired, you can toggle new capabilities just by setting the corresponding `*_MCP_HTTP_URL`—no redeploy required. 
