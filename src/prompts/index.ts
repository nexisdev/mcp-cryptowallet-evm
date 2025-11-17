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
};
