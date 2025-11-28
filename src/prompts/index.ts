import { FastMCP } from "fastmcp";

export const registerPrompts = (server: FastMCP): void => {
  server.addPrompt({
    name: "wallet_transaction_confirmation",
    description:
      "Generate a confirmation message summarizing a pending on-chain transaction for human review.",
    arguments: [
      { name: "to", description: "Recipient address or ENS name", required: true },
      { name: "value", description: "Amount of native token to send (in ETH)", required: true },
      { name: "network", description: "Network name or chain identifier", required: true },
      { name: "gasLimit", description: "Gas limit to be used for the transaction", required: false },
      { name: "gasPrice", description: "Gas price or max fee per gas (in Gwei)", required: false },
    ],
    load: ({
      to = "<missing-to>",
      value = "0",
      network = "unknown",
      gasLimit,
      gasPrice,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Please confirm the following transaction on ${network}:`);
      lines.push(`- Recipient: ${to}`);
      lines.push(`- Amount: ${value} ETH`);

      if (typeof gasLimit === "string") {
        lines.push(`- Gas Limit: ${gasLimit}`);
      }

      if (typeof gasPrice === "string") {
        lines.push(`- Gas Price: ${gasPrice} Gwei`);
      }

      lines.push("");
      lines.push("Confirm that the recipient, amount, and fees are correct before broadcasting.");

      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "wallet_troubleshooting_checklist",
    description:
      "Guided checklist to diagnose common wallet issues before executing sensitive operations.",
    arguments: [
      { name: "scenario", description: "Brief summary of the observed issue", required: true },
      { name: "network", description: "Network or chain experiencing the issue", required: false },
    ],
    load: ({
      scenario = "unspecified issue",
      network,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Troubleshooting checklist for scenario: ${scenario}`);
      if (typeof network === "string") {
        lines.push(`Network: ${network}`);
      }
      lines.push("");
      lines.push("1. Verify the configured RPC endpoint is responsive.");
      lines.push("2. Confirm the wallet has sufficient balance for gas.");
      lines.push("3. Ensure the account nonce matches on-chain state.");
      lines.push("4. Check recent network congestion or outages.");
      lines.push("5. Re-create the transaction with a higher priority fee if necessary.");

      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "wormhole_bridge_briefing",
    description: "Summarise a Wormhole bridge plan with risk checks and status follow-ups.",
    arguments: [
      { name: "sourceChain", description: "Origin chain name or ID", required: true },
      { name: "targetChain", description: "Destination chain name or ID", required: true },
      { name: "token", description: "Symbol or contract identifier for the asset being bridged", required: true },
      { name: "amount", description: "Amount of tokens to bridge", required: true },
    ],
    load: ({
      sourceChain = "unknown",
      targetChain = "unknown",
      token = "token",
      amount = "0",
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Bridge plan for ${amount} ${token} from ${sourceChain} to ${targetChain}`);
      lines.push("Safety checklist:");
      lines.push("- Confirm both chains are supported (use `wormhole_supported_routes`).");
      lines.push("- Validate recipient address format on the target chain.");
      lines.push("- Review current route congestion via `wormhole_route_status`.");
      lines.push("- Monitor transfer lifecycle with `wormhole_transfer_status`.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "debank_portfolio_digest",
    description: "Create a concise portfolio summary from DeBank holdings and exposures.",
    arguments: [
      { name: "address", description: "User wallet address", required: true },
      { name: "netWorthUsd", description: "Total net worth in USD", required: false },
      { name: "topProtocols", description: "Comma-separated list of top protocols", required: false },
    ],
    load: ({
      address,
      netWorthUsd,
      topProtocols,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Portfolio summary for ${address ?? "unknown address"}`);
      if (netWorthUsd) {
        lines.push(`- Net worth (USD): ${netWorthUsd}`);
      }
      if (topProtocols) {
        lines.push(`- Top protocols: ${topProtocols}`);
      }
      lines.push("");
      lines.push("Suggested follow-up actions:");
      lines.push("- Verify the largest positions for recent price/TVL changes.");
      lines.push("- Re-evaluate leverage usage and collateral health.");
      lines.push("- Consider rebalancing illiquid or high-volatility assets.");

      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "aave_health_review",
    description: "Summarise Aave account health and suggest mitigation steps.",
    arguments: [
      { name: "address", description: "Wallet address under review", required: true },
      { name: "healthFactor", description: "Latest health factor from `aave_user_health`", required: false },
      { name: "totalBorrowsUSD", description: "Total borrow value in USD", required: false },
      { name: "totalCollateralUSD", description: "Total collateral value in USD", required: false },
    ],
    load: ({
      address = "unknown",
      healthFactor,
      totalBorrowsUSD,
      totalCollateralUSD,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Aave health review for ${address}`);
      if (healthFactor) {
        lines.push(`- Health factor: ${healthFactor}`);
      }
      if (totalBorrowsUSD) {
        lines.push(`- Total borrows: $${totalBorrowsUSD}`);
      }
      if (totalCollateralUSD) {
        lines.push(`- Total collateral: $${totalCollateralUSD}`);
      }
      lines.push("");
      lines.push("Checklist:");
      lines.push("- If health factor < 1.15 consider repaying debt or adding collateral.");
      lines.push("- Prioritise high APY collateral additions before repaying debt.");
      lines.push("- Re-evaluate variable vs. stable borrow distribution.");
      lines.push("- Confirm oracle feeds look sane before any action.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "defi_trade_plan",
    description: "Draft an execution plan for an onchain swap using aggregator tools.",
    arguments: [
      { name: "chainId", description: "Chain identifier for the swap", required: true },
      { name: "sellToken", description: "Token contract being sold", required: true },
      { name: "buyToken", description: "Token contract being bought", required: true },
      { name: "sellAmount", description: "Amount in base units", required: true },
    ],
    load: ({
      chainId = "unknown",
      sellToken = "0x",
      buyToken = "0x",
      sellAmount = "0",
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push("DeFi trade planning steps");
      lines.push(`- Chain: ${chainId}`);
      lines.push(`- Sell token: ${sellToken}`);
      lines.push(`- Buy token: ${buyToken}`);
      lines.push(`- Amount (raw): ${sellAmount}`);
      lines.push("");
      lines.push("Recommended sequence:");
      lines.push("1. Call `defi_supported_chains` and `defi_liquidity_sources` to confirm routing.");
      lines.push("2. Retrieve indicative price via `defi_swap_price`.");
      lines.push("3. Generate executable payload with `defi_swap_quote` (adjust slippage as needed).");
      lines.push("4. If execution is automated, persist quote and broadcast with custodial tooling.");
      lines.push("5. Post-trade: fetch token prices using `defi_token_price` for PnL context.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "defi_swap_quote_brief",
    description:
      "Summarise a swap quote generated by `defi_swap_quote_structured`, calling out route, amounts, and slippage.",
    arguments: [
      { name: "quoteJson", description: "Structured quote JSON payload", required: true },
      { name: "notes", description: "Optional analyst notes or flags", required: false },
    ],
    load: ({
      quoteJson,
      notes,
    }: Record<string, string | undefined>): Promise<string> => {
      let parsed: Record<string, unknown> | null = null;
      if (quoteJson) {
        try {
          parsed = JSON.parse(quoteJson) as Record<string, unknown>;
        } catch {
          parsed = null;
        }
      }

      const blocks: string[] = [];
      blocks.push("Structured quote summary");
      if (parsed && typeof parsed === "object") {
        const metadata = parsed.metadata as Record<string, unknown> | undefined;
        if (metadata) {
          blocks.push(
            [
              "- Chain ID: ",
              String(metadata.chainId ?? "unknown"),
              "\n- Sell Token: ",
              String(metadata.sellToken ?? "unknown"),
              "\n- Buy Token: ",
              String(metadata.buyToken ?? "unknown"),
              "\n- Sell Amount: ",
              String(metadata.sellAmount ?? "unknown"),
              "\n- Slippage BPS: ",
              String(metadata.slippageBps ?? "default"),
            ].join(""),
          );
        }
        const quote = parsed.quote as Record<string, unknown> | undefined;
        if (quote) {
          blocks.push("Raw quote (truncated):");
          blocks.push(JSON.stringify(quote, null, 2).slice(0, 1200));
        }
      } else {
        blocks.push("Unable to parse quote JSON; include valid quoteJson input.");
      }

      if (notes) {
        blocks.push("");
        blocks.push(`Analyst notes: ${notes}`);
      }

      blocks.push("");
      blocks.push("Checklist:");
      blocks.push("- Confirm allowance / approvals match route.");
      blocks.push("- Re-price with `defi_swap_price` before broadcast.");
      blocks.push("- Monitor mempool for MEV slippage if size is material.");

      return Promise.resolve(blocks.join("\n"));
    },
  });

  server.addPrompt({
    name: "memecoin_deploy_workflow",
    description:
      "Plan and chain memecoin discovery, charting, and deployment using memeobs → hubble → memedeploy tools.",
    arguments: [
      { name: "theme", description: "Meme/theme to search for (e.g., cats, pepe, sports)", required: true },
      { name: "cluster", description: "Solana cluster to target (devnet or mainnet)", required: false },
      { name: "symbol", description: "Preferred token symbol (2–10 chars)", required: false },
      { name: "imageUrl", description: "URL to the token image/metadata", required: false },
    ],
    load: ({
      theme = "memes",
      cluster = "devnet",
      symbol = "TKN",
      imageUrl,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: string[] = [];
      lines.push(`Memecoin launch workflow for theme: ${theme}`);
      lines.push("");
      lines.push("1) Discovery (memeobs):");
      lines.push("   - Call `memeobs_scanNewMemecoins` (limit small) and `memeobs_getHypeScore` for candidates matching the theme.");
      lines.push("   - Fetch whale/flow signals with `memeobs_trackWhaleMovements`.");
      lines.push("");
      lines.push("2) Visualize trend (hubble):");
      lines.push("   - Summarize signals into a dataset.");
      lines.push("   - Call `hubble_generate_chart` to render a quick chart (categories: hypeScore, mentions, velocity).");
      lines.push("");
      lines.push("3) Deploy (memedeploy):");
      lines.push(
        `   - Use \`memedeploy_deploy_token\` with tokenName derived from theme, symbol ${symbol}, cluster ${cluster}, imageUrl ${imageUrl ?? "<provide imageUrl>"}, waitForCompletion=true.`,
      );
      lines.push("   - Read response for tokenAddress/poolAddress and share back.");
      lines.push("");
      lines.push("Safety notes:");
      lines.push("- Always run on devnet first; only switch to mainnet after human approval.");
      lines.push("- Confirm THIRDWEB_SERVICE_KEY and MEMEDEPLOY_TOKEN_API creds are configured before deploy.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "deepresearch_general_workflow",
    description:
      "Step-plan for running the deep-research agent on any general inquiry and sharing results with collaborators.",
    arguments: [
      { name: "query", description: "User question or topic to investigate", required: true },
      { name: "depth", description: "Search depth 1-5 (default 3)", required: false },
      { name: "breadth", description: "Search breadth 1-5 (default 2)", required: false },
      { name: "roomId", description: "Optional agentcomm room to post findings", required: false },
    ],
    load: ({ query, depth = "3", breadth = "2", roomId }: Record<string, string | undefined>): Promise<string> => {
      const steps: string[] = [];
      steps.push(`Run deep research on: "${query ?? "topic"}" (depth ${depth}, breadth ${breadth}).`);
      steps.push("- Call `deepresearch_deep-research` with the above params.");
      steps.push("- Extract structuredContent.summary and key sources.");
      if (roomId) {
        steps.push(`- Post summary + sources to agent room ${roomId} via \`agentcomm_post_message\`.`);
        steps.push("- Listen for peer responses with `agentcomm_wait_for_messages` (optional).");
      }
      steps.push("- Provide concise brief + source list to the user.");
      return Promise.resolve(steps.join("\n"));
    },
  });

  server.addPrompt({
    name: "deepresearch_memecoin_workflow",
    description:
      "Research pipeline for memecoins: discovery, risk checks, sentiment, and action recommendations.",
    arguments: [
      { name: "theme", description: "Meme/theme or token name", required: true },
      { name: "roomId", description: "Agentcomm room for collaboration", required: false },
    ],
    load: ({ theme, roomId }: Record<string, string | undefined>): Promise<string> => {
      const lines: string[] = [];
      lines.push(`Memecoin research workflow for theme: ${theme ?? "unknown"}`);
      lines.push("- Discovery: `memeobs_scanNewMemecoins` + `memeobs_getHypeScore`.");
      lines.push("- Whale flow: `memeobs_trackWhaleMovements`.");
      lines.push("- Deep context: `deepresearch_deep-research` on the top 3 candidates (depth 2, breadth 2).");
      lines.push("- Risk: `memeobs_runRugpullScan` if available, else code/ownership checks manually.");
      lines.push("- Visuals: `hubble_generate_chart` for hype/volume over time (if data available).");
      if (roomId) {
        lines.push(`- Share packet to room ${roomId} via \`agentcomm_post_message\`; await feedback with \`agentcomm_wait_for_messages\`.`);
      }
      lines.push("- Output: shortlist with hype score, whales, risks, liquidity notes, and next actions.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "deepresearch_token_workflow",
    description:
      "Token due-diligence workflow using deepresearch plus on-chain/lookups.",
    arguments: [
      { name: "tokenSymbol", description: "Token symbol/ticker", required: true },
      { name: "contract", description: "Contract address (if EVM/solana mint)", required: false },
      { name: "roomId", description: "Agentcomm room to broadcast findings", required: false },
    ],
    load: ({ tokenSymbol, contract, roomId }: Record<string, string | undefined>): Promise<string> => {
      const out: string[] = [];
      out.push(`Token research for ${tokenSymbol ?? "token"}`);
      out.push("- Run `deepresearch_deep-research` on project name + ticker (depth 3, breadth 2).");
      if (contract) {
        out.push(`- On-chain: price/liquidity via \`pumpswap_token_info\` (Solana) or \`defi_token_price\` (EVM) for ${contract}.`);
      } else {
        out.push("- On-chain: resolve contract then price/liquidity via pumpswap/defi modules.");
      }
      out.push("- Holders/flows: use memeobs or inspector tools if available.");
      if (roomId) {
        out.push(`- Share findings to room ${roomId} with \`agentcomm_post_message\`.`);
      }
      out.push("- Deliver summary with provenance links and risk flags (ownership, renounce, liquidity locks).");
      return Promise.resolve(out.join("\n"));
    },
  });

  server.addPrompt({
    name: "deepresearch_market_analysis_workflow",
    description:
      "Market analysis workflow (sector or asset basket) combining deepresearch with on-chain/price data.",
    arguments: [
      { name: "topic", description: "Sector/market topic (e.g., 'L2 rollups', 'Solana memecoins')", required: true },
      { name: "horizon", description: "Time horizon (e.g., 1w, 1m, 1q)", required: false },
      { name: "roomId", description: "Agentcomm room for team review", required: false },
    ],
    load: ({ topic, horizon = "1m", roomId }: Record<string, string | undefined>): Promise<string> => {
      const steps: string[] = [];
      steps.push(`Market analysis for: ${topic ?? "market"} (horizon ${horizon})`);
      steps.push("- Context: run `deepresearch_deep-research` (depth 3, breadth 3) on the sector.");
      steps.push("- Data pulls: ");
      steps.push("  * Prices/liquidity via pumpswap/defi where applicable.");
      steps.push("  * Narratives/news via deepresearch sources list.");
      steps.push("- Visualization: optional `hubble_generate_chart` to plot key metrics over horizon.");
      if (roomId) {
        steps.push(`- Share interim deck to room ${roomId} with \`agentcomm_post_message\`; gather replies with \`agentcomm_wait_for_messages\`.`);
      }
      steps.push("- Deliver concise thesis, catalysts, risks, and watchlist actions.");
      return Promise.resolve(steps.join("\n"));
    },
  });

  server.addPrompt({
    name: "pumpfun_1000x_research_workflow",
    description:
      "End-to-end flow to scout pump.fun tokens with 1000x potential using pumpfun/memeobs/deepresearch/hubble/pumpswap tools.",
    arguments: [
      { name: "theme", description: "Narrative or meme to target (e.g., 'cats ai', 'sports playoffs')", required: true },
      { name: "budgetSol", description: "Budget in SOL for test entries (optional)", required: false },
      { name: "roomId", description: "Agentcomm room to share findings", required: false },
    ],
    load: ({ theme, budgetSol = "0.5", roomId }: Record<string, string | undefined>): Promise<string> => {
      const lines: string[] = [];
      lines.push(`Pump.fun 1000x scouting workflow for theme: ${theme ?? "unspecified"}`);
      lines.push("");
      lines.push("1) Discovery");
      lines.push("- Use `memeobs_scanNewMemecoins` filtered by theme keywords.");
      lines.push("- Rank with `memeobs_getHypeScore`; keep top 10.");
      lines.push("- Check whales with `memeobs_trackWhaleMovements`.");
      lines.push("");
      lines.push("2) Fundamentals & risk");
      lines.push("- Run `deepresearch_deep-research` on top 3 tickers (depth 2, breadth 2).");
      lines.push("- If available, call pump.fun-specific toolset (prefixed `pumpfun_`/`pumpswap_`) to verify pool, liquidity, mint status.");
      lines.push("- Rug checks: ownership, mint authority, liquidity locks (manual notes).");
      lines.push("");
      lines.push("3) Price/liq context");
      lines.push("- Fetch quotes with `pumpswap_price`/`pumpswap_token_info`; simulate entries via `pumpswap_quote`.");
      lines.push("- Build quick chart of hype score vs volume using `hubble_generate_chart`.");
      lines.push("");
      lines.push("4) Plan & communicate");
      lines.push(`- Draft entry plan (size ~${budgetSol} SOL test) with tight slippage; mark exits at x5/x10.`);
      if (roomId) {
        lines.push(`- Post shortlist + plan to room ${roomId} via \`agentcomm_post_message\`; gather feedback with \`agentcomm_wait_for_messages\`.`);
      }
      lines.push("");
      lines.push("5) Execute (opt-in)");
      lines.push("- Only after human approval: use appropriate wallet flow (Thirdweb Solana) and `pumpswap_quote` output for execution.");
      lines.push("- Monitor with memeobs whale/momentum signals post-entry.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "defiyields_analyze_yields",
    description: "Analyzes a list of yield pools and provides a summary of the findings.",
    arguments: [
      { name: "pools", description: "A JSON array of yield pools to analyze", required: true },
    ],
    load: ({
      pools,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push("Please analyze the following yield pools and provide a summary of your findings.");
      lines.push("For each pool, please analyze the APY, 30-day mean APY, and predict future trends.");
      lines.push("Present your analysis in a clear and concise way.");
      lines.push("");
      lines.push("Pools to analyze:");
      lines.push(pools ?? "No pools provided.");

      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "lista_vault_strategy",
    description: "Analyze Lista DAO vaults and suggest a deposit strategy.",
    arguments: [
      { name: "zone", description: "Vault zone (classic, alpha, aster)", required: false },
      { name: "amount", description: "Amount to invest", required: false },
    ],
    load: ({
      zone = "classic",
      amount = "0",
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Lista Vault Strategy for ${zone} zone`);
      lines.push(`Investment Amount: ${amount}`);
      lines.push("");
      lines.push("Steps:");
      lines.push("1. Call `lista_list_vaults` to fetch current APYs and TVL.");
      lines.push("2. Identify vaults with high utilization and safe collateral.");
      lines.push("3. If depositing, ensure you have the underlying asset.");
      lines.push("4. Use `lista_deposit` to execute.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "stargate_bridge_plan",
    description: "Plan a cross-chain transfer via Stargate.",
    arguments: [
      { name: "srcChain", description: "Source chain key", required: true },
      { name: "dstChain", description: "Destination chain key", required: true },
      { name: "token", description: "Token symbol or address", required: true },
      { name: "amount", description: "Amount to bridge", required: true },
    ],
    load: ({
      srcChain,
      dstChain,
      token,
      amount,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Stargate Bridge Plan: ${amount} ${token} from ${srcChain} to ${dstChain}`);
      lines.push("");
      lines.push("Execution Checklist:");
      lines.push("1. Verify chain support with `stargate_list_chains`.");
      lines.push("2. Check token availability with `stargate_list_tokens`.");
      lines.push("3. Get a quote using `stargate_get_quotes` to check fees and slippage.");
      lines.push("4. Execute with `stargate_bridge`.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "cryptofunds_analysis",
    description: "Analyze crypto funds and their portfolios.",
    arguments: [
      { name: "focus", description: "Area of interest (e.g., 'tier 1', 'defi')", required: true },
    ],
    load: ({
      focus,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Crypto Fund Analysis: ${focus}`);
      lines.push("");
      lines.push("Research Steps:");
      lines.push("1. Use `cryptofunds_search` to find funds matching the criteria.");
      lines.push("2. Retrieve details for top matches using `cryptofunds_get_detail`.");
      lines.push("3. Look for portfolio overlaps and recent performance.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "polymarket_event_scout",
    description: "Find and analyze prediction markets on Polymarket.",
    arguments: [
      { name: "topic", description: "Topic to search for (e.g., 'election', 'crypto')", required: true },
    ],
    load: ({
      topic,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Polymarket Scout: ${topic}`);
      lines.push("");
      lines.push("Scouting Actions:");
      lines.push("1. Search events with `polymarket_search_events`.");
      lines.push("2. List specific markets for top events using `polymarket_get_markets`.");
      lines.push("3. Analyze volume and spread to determine market sentiment.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "cryptostocks_summary",
    description: "Summarize performance of crypto-related equities.",
    arguments: [
      { name: "tickers", description: "Comma-separated list of tickers (e.g., 'COIN,MSTR')", required: true },
    ],
    load: ({
      tickers,
    }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Crypto Stocks Summary for: ${tickers}`);
      lines.push("");
      lines.push("Analysis:");
      lines.push("1. Fetch current prices with `cryptostocks_price`.");
      lines.push("2. Get historical context (30d) using `cryptostocks_history`.");
      lines.push("3. Compare performance against BTC/ETH price action.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "aster_market_depth",
    description: "Analyze order book depth and recent trades for a symbol on Aster.",
    arguments: [
      { name: "symbol", description: "Trading pair symbol (e.g., BTC-USDT)", required: true },
      { name: "limit", description: "Depth limit", required: false },
    ],
    load: ({ symbol, limit = "10" }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Aster Market Depth Analysis: ${symbol}`);
      lines.push("");
      lines.push("Steps:");
      lines.push("1. Fetch order book with `aster_order_book`.");
      lines.push("2. Get recent trades with `aster_recent_trades`.");
      lines.push("3. Analyze spread and liquidity depth.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "bsc_transfer_checklist",
    description: "Safety checks before sending BNB or BEP-20 tokens.",
    arguments: [
      { name: "recipient", description: "Destination address", required: true },
      { name: "token", description: "Token symbol (or 'BNB')", required: true },
      { name: "amount", description: "Amount to send", required: true },
    ],
    load: ({ recipient, token, amount }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`BSC Transfer Checklist: ${amount} ${token} to ${recipient}`);
      lines.push("");
      lines.push("1. Verify recipient address format.");
      lines.push("2. Check `bsc_token_balance` to ensure sufficient funds.");
      lines.push("3. If token is not BNB, ensure you have BNB for gas.");
      lines.push("4. Use `bsc_transfer_native` (BNB) or `bsc_transfer_token` (BEP-20).");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "cryptopanic_news_digest",
    description: "Summarize latest news for a specific currency or filter.",
    arguments: [
      { name: "currency", description: "Currency code (e.g., BTC)", required: false },
      { name: "filter", description: "Filter (rising, hot, bullish, bearish)", required: false },
    ],
    load: ({ currency, filter }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`CryptoPanic News Digest`);
      if (currency) lines.push(`Currency: ${currency}`);
      if (filter) lines.push(`Filter: ${filter}`);
      lines.push("");
      lines.push("Action:");
      lines.push("- Call `cryptopanic_latest_news` with provided arguments.");
      lines.push("- Summarize key headlines and sentiment.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "cryptoprojects_protocol_audit",
    description: "Deep dive into a protocol's TVL and details via DefiLlama.",
    arguments: [
      { name: "slug", description: "Protocol slug (e.g., 'lido', 'aave')", required: true },
    ],
    load: ({ slug }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Protocol Audit: ${slug}`);
      lines.push("");
      lines.push("Steps:");
      lines.push("1. Fetch details with `cryptoprojects_protocol_details`.");
      lines.push("2. Analyze TVL trends and chain breakdown.");
      lines.push("3. Compare with competitors using `cryptoprojects_top_protocols`.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "pumpswap_trade_setup",
    description: "Prepare a trade on Solana via Jupiter.",
    arguments: [
      { name: "inputMint", description: "Input token mint", required: true },
      { name: "outputMint", description: "Output token mint", required: true },
      { name: "amount", description: "Amount (in atoms)", required: true },
    ],
    load: ({ inputMint, outputMint, amount }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`PumpSwap Trade Setup`);
      lines.push(`Input: ${inputMint}`);
      lines.push(`Output: ${outputMint}`);
      lines.push(`Amount: ${amount}`);
      lines.push("");
      lines.push("1. Check prices with `pumpswap_price`.");
      lines.push("2. Get token metadata with `pumpswap_token_info`.");
      lines.push("3. Fetch quote with `pumpswap_quote`.");
      return Promise.resolve(lines.join("\n"));
    },
  });

  server.addPrompt({
    name: "web3research_asset_report",
    description: "Comprehensive report on an asset using CoinGecko data.",
    arguments: [
      { name: "query", description: "Asset name or symbol", required: true },
    ],
    load: ({ query }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`Web3 Research Report: ${query}`);
      lines.push("");
      lines.push("1. Find asset ID with `web3research_search_assets`.");
      lines.push("2. Fetch market data with `web3research_asset_details`.");
      lines.push("3. Check if it's in `web3research_trending`.");
      return Promise.resolve(lines.join("\n"));
    },
  });
  server.addPrompt({
    name: "defitrading_swap_plan",
    description: "Plan a swap using the native DeFi Trading module.",
    arguments: [
      { name: "chainId", description: "Chain ID", required: true },
      { name: "sellToken", description: "Sell token address", required: true },
      { name: "buyToken", description: "Buy token address", required: true },
      { name: "sellAmount", description: "Amount to sell", required: true },
    ],
    load: ({ chainId, sellToken, buyToken, sellAmount }: Record<string, string | undefined>): Promise<string> => {
      const lines: Array<string> = [];
      lines.push(`DeFi Trading Swap Plan`);
      lines.push(`Chain: ${chainId}`);
      lines.push(`Sell: ${sellToken} (${sellAmount})`);
      lines.push(`Buy: ${buyToken}`);
      lines.push("");
      lines.push("1. Get price with `defitrading_get_swap_price`.");
      lines.push("2. Get quote with `defitrading_get_swap_quote`.");
      lines.push("3. Execute with `defitrading_execute_swap`.");
      return Promise.resolve(lines.join("\n"));
    },
  });
  server.addPrompt({
    name: "solana_memecoin_sniper",
    description: "Scout for hyped Solana tokens, verify safety, and prepare a buy order.",
    arguments: [
      { name: "minHypeScore", description: "Minimum hype score (0-100)", required: false },
      { name: "budgetSol", description: "Amount of SOL to spend", required: true },
    ],
    load: ({ minHypeScore = "80", budgetSol }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Memecoin Sniper Mission (Min Hype: ${minHypeScore}, Budget: ${budgetSol} SOL)`);
      lines.push("");
      lines.push("1. **Scout**: Call `solana_get_hype_score` for trending tokens.");
      lines.push("2. **Verify**: For the top candidate:");
      lines.push("   - Call `solana_get_token_data` to check supply and mint authority.");
      lines.push("   - Ensure liquidity > $10k via `solana_get_token_data`.");
      lines.push("3. **Execution**: ");
      lines.push(`   - Call \`solana_create_limit_order\` (as market buy proxy) or \`solana_agent_trade\` if available.`);
      lines.push("4. **Report**: Summarize the token's metrics and present the unsigned transaction.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_portfolio_rebalance",
    description: "Check balances and suggest trades to rebalance portfolio.",
    arguments: [
      { name: "targetAllocation", description: "JSON string of target allocation (e.g. {'SOL': 50, 'USDC': 50})", required: true },
    ],
    load: ({ targetAllocation }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Portfolio Rebalance Plan (Target: ${targetAllocation})`);
      lines.push("1. Call `solana_agent_get_balance` for all relevant tokens.");
      lines.push("2. Calculate current allocation vs target.");
      lines.push("3. Generate `solana_create_limit_order` transactions to sell overweight and buy underweight assets.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_rug_check",
    description: "Perform a safety check on a Solana token.",
    arguments: [
      { name: "mintAddress", description: "Token mint address", required: true },
    ],
    load: ({ mintAddress }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Rug Check for ${mintAddress}`);
      lines.push("1. Call `solana_get_token_data` to get supply, decimals, and authority info.");
      lines.push("2. Call `solana_get_hype_score` to see social backing.");
      lines.push("3. Check if Mint Authority is disabled (should be null).");
      lines.push("4. Check if Freeze Authority is disabled (should be null).");
      lines.push("5. Report findings with a safety score.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_limit_order_grid",
    description: "Plan a grid of limit orders.",
    arguments: [
      { name: "inputMint", description: "Input token mint", required: true },
      { name: "outputMint", description: "Output token mint", required: true },
      { name: "rangeLow", description: "Lower price bound", required: true },
      { name: "rangeHigh", description: "Upper price bound", required: true },
      { name: "grids", description: "Number of grid lines", required: true },
    ],
    load: ({ inputMint, outputMint, rangeLow, rangeHigh, grids }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Grid Trading Plan: ${inputMint} -> ${outputMint}`);
      lines.push(`Range: ${rangeLow} - ${rangeHigh}, Grids: ${grids}`);
      lines.push("1. Calculate price levels.");
      lines.push("2. Use `workflow_ladder_limit_orders` (Composite Tool) to generate the transactions in one go.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_social_sentiment_analysis",
    description: "Analyze social sentiment for a token.",
    arguments: [
      { name: "tokenSymbol", description: "Token symbol", required: true },
    ],
    load: ({ tokenSymbol }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Sentiment Analysis for ${tokenSymbol}`);
      lines.push("1. Call `solana_get_hype_score`.");
      lines.push("2. Interpret the score (0-100).");
      lines.push("3. If score > 80, recommend 'Strong Buy'.");
      lines.push("4. If score < 20, recommend 'Avoid'.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_whale_watch",
    description: "Monitor a whale wallet and suggest actions.",
    arguments: [
      { name: "whaleAddress", description: "Wallet address to watch", required: true },
    ],
    load: ({ whaleAddress }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Whale Watcher: ${whaleAddress}`);
      lines.push("1. Call `solana_agent_get_balance` to see current holdings.");
      lines.push("2. Call `solana_get_order_history` to see recent trades.");
      lines.push("3. Identify any new large positions.");
      lines.push("4. If a new position is found, call `solana_get_hype_score` on it.");
      lines.push("5. If hype is high, suggest copying the trade.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_arbitrage_scanner",
    description: "Scan for arbitrage opportunities.",
    arguments: [
      { name: "tokenMint", description: "Token mint to check", required: true },
    ],
    load: ({ tokenMint }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Arbitrage Scanner for ${tokenMint}`);
      lines.push("1. Call `pumpswap_price` to get Jupiter price.");
      lines.push("2. Call `solana_get_token_data` to check on-chain liquidity pool price (if available).");
      lines.push("3. Compare prices.");
      lines.push("4. If difference > 2%, suggest an arb trade.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_token_launch_coordinator",
    description: "Coordinate a token launch with social hype.",
    arguments: [
      { name: "theme", description: "Token theme", required: true },
    ],
    load: ({ theme }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Launch Coordinator for theme: ${theme}`);
      lines.push("1. Research current trends with `solana_social_sentiment_analysis`.");
      lines.push("2. Suggest a name and symbol.");
      lines.push("3. Use `workflow_launch_and_fund_dao` to deploy and fund.");
      lines.push("4. Post about it on Twitter (manual step or future tool).");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_hype_based_trade",
    description: "Execute a trade based purely on hype score.",
    arguments: [
      { name: "tokenMint", description: "Token mint", required: true },
      { name: "threshold", description: "Hype threshold", required: false },
    ],
    load: ({ tokenMint, threshold = "80" }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Hype Trade for ${tokenMint} (Threshold: ${threshold})`);
      lines.push("1. Call `solana_get_hype_score`.");
      lines.push(`2. If score >= ${threshold}, call \`solana_create_limit_order\` to buy.`);
      lines.push("3. Else, report 'Hype too low'.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "solana_daily_briefing",
    description: "Generate a daily briefing of portfolio and market.",
    arguments: [
      { name: "walletAddress", description: "Your wallet address", required: true },
    ],
    load: ({ walletAddress }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Daily Briefing for ${walletAddress}`);
      lines.push("1. Portfolio: Call `solana_agent_get_balance`.");
      lines.push("2. Orders: Call `solana_get_open_orders`.");
      lines.push("3. Market: Call `solana_get_hype_score` for top tokens (e.g. SOL, BONK).");
      lines.push("4. Summarize net worth and actionable insights.");
      return Promise.resolve(lines.join("\n"));
    }
  });
  server.addPrompt({
    name: "evm_yield_farmer",
    description: "Find the best yield farming opportunities on EVM chains.",
    arguments: [
      { name: "chain", description: "Chain to search (e.g. Ethereum, Arbitrum)", required: true },
      { name: "asset", description: "Asset to farm (e.g. USDC, ETH)", required: true },
    ],
    load: ({ chain, asset }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Yield Farming Search for ${asset} on ${chain}`);
      lines.push("1. Call `defiyields_get_pools` filtering by chain.");
      lines.push("2. Filter results for the specified asset.");
      lines.push("3. Sort by APY and TVL.");
      lines.push("4. Present top 3 opportunities with risk assessment.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "market_research_deep_dive",
    description: "Conduct a deep dive research on a specific crypto project or topic.",
    arguments: [
      { name: "topic", description: "Project name or topic", required: true },
    ],
    load: ({ topic }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Deep Dive Research: ${topic}`);
      lines.push("1. Call `web3research_search_assets` to find project details.");
      lines.push("2. Call `web3research_asset_details` for market cap, price, and description.");
      lines.push("3. Search for recent news or governance proposals (if available).");
      lines.push("4. Summarize fundamental strengths and weaknesses.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "evm_token_creator_guide",
    description: "Guide to creating and deploying an ERC20 token.",
    arguments: [
      { name: "name", description: "Token Name", required: true },
      { name: "symbol", description: "Token Symbol", required: true },
    ],
    load: ({ name, symbol }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Token Creation Guide: ${name} (${symbol})`);
      lines.push("1. Explain the parameters (Supply, Decimals).");
      lines.push("2. Use `workflow_evm_token_deploy` to generate the deployment transaction.");
      lines.push("3. Explain next steps: Verification on Etherscan, Liquidity Provision.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "cross_chain_yield_aggregator",
    description: "Compare yields across multiple chains for a specific asset.",
    arguments: [
      { name: "asset", description: "Asset (e.g. USDC)", required: true },
    ],
    load: ({ asset }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Cross-Chain Yield Aggregator for ${asset}`);
      lines.push("1. Call `defiyields_get_pools` for Ethereum.");
      lines.push("2. Call `defiyields_get_pools` for Arbitrum.");
      lines.push("3. Call `defiyields_get_pools` for Polygon.");
      lines.push("4. Aggregate and compare top yields.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "project_due_diligence",
    description: "Perform due diligence on a project before investing.",
    arguments: [
      { name: "projectName", description: "Project Name", required: true },
    ],
    load: ({ projectName }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Due Diligence: ${projectName}`);
      lines.push("1. Market Data: `web3research_asset_details`.");
      lines.push("2. Community: Check Twitter/Discord sentiment (manual or future tool).");
      lines.push("3. Code: Check for audits (manual).");
      lines.push("4. Yields: Check `defiyields_get_pools` if applicable.");
      lines.push("5. Assign a risk score (1-10).");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "evm_whale_watch",
    description: "Monitor large transactions on EVM chains.",
    arguments: [
      { name: "address", description: "Address to watch", required: true },
    ],
    load: ({ address }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`EVM Whale Watch: ${address}`);
      lines.push("1. Check balance using standard RPC tools.");
      lines.push("2. Monitor for large transfers.");
      lines.push("3. If a transfer > 100 ETH occurs, alert user.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "yield_opportunity_alert",
    description: "Alert on new high-yield opportunities.",
    arguments: [
      { name: "minApy", description: "Minimum APY %", required: true },
    ],
    load: ({ minApy }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Yield Alert (Min APY: ${minApy}%)`);
      lines.push("1. Scan `defiyields_get_pools` across major chains.");
      lines.push(`2. Filter for pools with APY > ${minApy}%.`);
      lines.push("3. Filter out low TVL pools (< $1M) for safety.");
      lines.push("4. List top 5 opportunities.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "token_launch_strategy",
    description: "Strategic plan for launching a new token.",
    arguments: [
      { name: "projectType", description: "Type (Meme, Utility, Governance)", required: true },
    ],
    load: ({ projectType }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Launch Strategy for ${projectType} Token`);
      lines.push("1. Pre-Launch: `market_research_deep_dive` on competitors.");
      lines.push("2. Technical: `evm_token_creator_guide` for deployment.");
      lines.push("3. Liquidity: Plan initial liquidity using `workflow_yield_portfolio_builder` insights.");
      lines.push("4. Marketing: Define key narratives.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "market_sentiment_report",
    description: "Generate a report on overall market sentiment.",
    arguments: [],
    load: () => {
      const lines = [];
      lines.push("Market Sentiment Report");
      lines.push("1. Call `web3research_trending` to see what's hot.");
      lines.push("2. Check Bitcoin and Ethereum price trends.");
      lines.push("3. Analyze sector performance (DeFi, AI, Memes).");
      lines.push("4. Conclude: Bullish, Bearish, or Neutral.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "defi_protocol_analyzer",
    description: "Analyze a specific DeFi protocol's health.",
    arguments: [
      { name: "protocol", description: "Protocol Name", required: true },
    ],
    load: ({ protocol }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Protocol Analysis: ${protocol}`);
      lines.push("1. TVL Analysis: Check DefiLlama stats (via `defiyields_get_pools` proxy or web search).");
      lines.push("2. Yields: Check `defiyields_get_pools` for their pools.");
      lines.push("3. Token Performance: `web3research_asset_details`.");
      lines.push("4. Summary of protocol health.");
      return Promise.resolve(lines.join("\n"));
    }
  });
  server.addPrompt({
    name: "cross_chain_bridge_optimizer",
    description: "Find the best route to bridge assets across chains.",
    arguments: [
      { name: "asset", description: "Asset to bridge", required: true },
      { name: "amount", description: "Amount", required: true },
      { name: "sourceChain", description: "Source Chain", required: true },
      { name: "destChain", description: "Destination Chain", required: true },
    ],
    load: ({ asset, amount, sourceChain, destChain }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Bridge Optimizer: ${amount} ${asset} from ${sourceChain} to ${destChain}`);
      lines.push("1. Check Wormhole routes.");
      lines.push("2. Check Stargate routes.");
      lines.push("3. Compare fees and speed.");
      lines.push("4. Generate transaction using `workflow_omnichain_yield_farmer` logic (or specific bridge tool).");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "smart_contract_auditor",
    description: "Perform a quick security audit on a contract.",
    arguments: [
      { name: "contractAddress", description: "Contract Address", required: true },
      { name: "chain", description: "Chain", required: true },
    ],
    load: ({ contractAddress, chain }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Audit Request for ${contractAddress} on ${chain}`);
      lines.push("1. Fetch verified code from Etherscan (if available).");
      lines.push("2. Check for common vulnerabilities (Reentrancy, Overflow).");
      lines.push("3. Check owner privileges.");
      lines.push("4. Provide a safety score.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "nft_floor_sweeper",
    description: "Strategy to sweep the floor of an NFT collection.",
    arguments: [
      { name: "collection", description: "Collection Address", required: true },
      { name: "maxPrice", description: "Max Price per NFT", required: true },
      { name: "count", description: "Number to buy", required: true },
    ],
    load: ({ collection, maxPrice, count }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Floor Sweeper: ${count} NFTs from ${collection} (Max: ${maxPrice})`);
      lines.push("1. Check current floor price.");
      lines.push("2. Identify listings below maxPrice.");
      lines.push("3. Generate batch buy transaction.");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "airdrop_farmer_route",
    description: "Generate a route for airdrop farming.",
    arguments: [
      { name: "targetProject", description: "Project to farm (e.g. Scroll, zkSync)", required: true },
    ],
    load: ({ targetProject }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Airdrop Farming Route: ${targetProject}`);
      lines.push("1. Bridge in.");
      lines.push("2. Swap on top DEX.");
      lines.push("3. Lend on top Lending Protocol.");
      lines.push("4. Mint an NFT.");
      lines.push("5. Bridge out (optional).");
      return Promise.resolve(lines.join("\n"));
    }
  });

  server.addPrompt({
    name: "health_factor_guardian",
    description: "Monitor DeFi health factor and protect against liquidation.",
    arguments: [
      { name: "protocol", description: "Protocol (Aave, Compound)", required: true },
      { name: "minHealth", description: "Minimum Health Factor", required: true },
    ],
    load: ({ protocol, minHealth }: Record<string, string | undefined>) => {
      const lines = [];
      lines.push(`Health Guardian: ${protocol} (Min HF: ${minHealth})`);
      lines.push("1. Check current Health Factor.");
      lines.push(`2. If HF < ${minHealth}, suggest Repay or Supply Collateral.`);
      lines.push("3. Generate emergency transaction if critical.");
      return Promise.resolve(lines.join("\n"));
    }
  });
};
