import { UserError } from "fastmcp";
import { formatKeyValue } from "../wallet/utils.js";
import {
  executeGraphQuery,
  getProviderConfig,
  setProviderConfig,
} from "./service.js";
import type {
  LiquidityInput,
  ProviderSetInput,
  UserDataInput,
} from "./schemas.js";
import { AAVE_NAMESPACE } from "./constants.js";
import type { ServerContext } from "../../server/types.js";

type FastMCPContext = ServerContext;

type AaveReserve = {
  symbol: string;
  underlyingAsset: string;
  totalLiquidity: string;
  availableLiquidity: string;
  variableBorrowRate: string;
  liquidityRate: string;
  decimals: string;
  reserveLiquidationThreshold?: string;
  reserveLiquidationBonus?: string;
};

type AaveUserReserve = {
  reserve: {
    symbol: string;
    decimals: string;
    underlyingAsset: string;
  };
  currentATokenBalance: string;
  currentTotalDebt: string;
  scaledVariableDebt: string;
  principalStableDebt: string;
  usageAsCollateralEnabledOnUser: boolean;
  lastUpdateTimestamp: string;
};

type AaveUserSummary = {
  id: string;
  healthFactor: string;
  totalCollateralUSD: string;
  totalBorrowsUSD: string;
};

type ReservesResponse = {
  reserves: AaveReserve[];
};

type UserResponse = {
  user?: AaveUserSummary | null;
  userReserves: AaveUserReserve[];
};

const RESERVES_QUERY = `
  query ReservesSummary {
    reserves {
      symbol
      underlyingAsset
      totalLiquidity
      availableLiquidity
      variableBorrowRate
      liquidityRate
      decimals
      reserveLiquidationThreshold
      reserveLiquidationBonus
    }
  }
`;

const USER_POSITIONS_QUERY = `
  query UserPositions($user: ID!) {
    user(id: $user) {
      id
      healthFactor
      totalCollateralUSD
      totalBorrowsUSD
    }
    userReserves(where: { user: $user }) {
      reserve {
        symbol
        decimals
        underlyingAsset
      }
      currentATokenBalance
      currentTotalDebt
      scaledVariableDebt
      principalStableDebt
      usageAsCollateralEnabledOnUser
      lastUpdateTimestamp
    }
  }
`;

const toDecimal = (value: string, decimals: number): number => {
  if (!value) {
    return 0;
  }
  const asBigInt = BigInt(value);
  const divisor = 10 ** decimals;
  return Number(asBigInt) / divisor;
};

const formatPercentage = (value: string, multiplier = 1e2): string => {
  if (!value) {
    return "0.00%";
  }
  const asBigInt = BigInt(value);
  const rate = Number(asBigInt) / 1e27;
  return `${(rate * multiplier).toFixed(2)}%`;
};

const classifyHealthFactor = (value: number | undefined): string => {
  if (value === undefined || Number.isNaN(value)) {
    return "unknown";
  }
  if (value >= 2) {
    return "healthy";
  }
  if (value >= 1.1) {
    return "caution";
  }
  if (value >= 1) {
    return "risk";
  }
  return "liquidation likely";
};

export const setAaveProviderHandler = async (
  args: ProviderSetInput,
  context: FastMCPContext,
): Promise<string> => {
  const config = await setProviderConfig(context, args);
  return formatKeyValue("Aave provider configured", {
    subgraphUrl: config.subgraphUrl,
    apiKey: config.apiKey ? "configured" : "not set",
    cacheTtlMs: config.cacheTtlMs,
  });
};

export const getAaveProviderInfoHandler = async (
  _args: Record<string, never>,
  context: FastMCPContext,
): Promise<string> => {
  const config = await getProviderConfig(context);
  return formatKeyValue("Aave provider", {
    subgraphUrl: config.subgraphUrl,
    apiKey: config.apiKey ? "configured" : "not set",
    cacheTtlMs: config.cacheTtlMs,
  });
};

export const getReservesHandler = async (
  _args: Record<string, never>,
  context: FastMCPContext,
): Promise<string> => {
  const { reserves } = await executeGraphQuery<ReservesResponse>(
    context,
    RESERVES_QUERY,
  );

  const summary = reserves.slice(0, 10).map((reserve) => {
    const decimals = Number.parseInt(reserve.decimals, 10);
    const total = toDecimal(reserve.totalLiquidity, decimals);
    const available = toDecimal(reserve.availableLiquidity, decimals);

    return formatKeyValue(reserve.symbol, {
      asset: reserve.underlyingAsset,
      totalLiquidity: total.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      availableLiquidity: available.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      variableBorrowRate: formatPercentage(reserve.variableBorrowRate),
      depositRate: formatPercentage(reserve.liquidityRate),
      liquidationThreshold: reserve.reserveLiquidationThreshold
        ? `${Number(reserve.reserveLiquidationThreshold) / 100}%`
        : "n/a",
    });
  });

  return [
    `Aave V3 reserves (${reserves.length} total)`,
    ...summary,
  ].join("\n\n");
};

export const analyzeLiquidityHandler = async (
  args: LiquidityInput,
  context: FastMCPContext,
): Promise<string> => {
  const symbol = args.symbol.toUpperCase();
  const { reserves } = await executeGraphQuery<ReservesResponse>(
    context,
    RESERVES_QUERY,
  );

  const match = reserves.find(
    (reserve) => reserve.symbol.toUpperCase() === symbol,
  );

  if (!match) {
    throw new UserError(`Reserve ${symbol} not found in Aave markets.`);
  }

  const decimals = Number.parseInt(match.decimals, 10);
  const total = toDecimal(match.totalLiquidity, decimals);
  const available = toDecimal(match.availableLiquidity, decimals);

  const utilisation = total > 0 ? (1 - available / total) * 100 : 0;

  return [
    `${symbol} Reserve Liquidity`,
    `- Asset: ${match.underlyingAsset}`,
    `- Total Liquidity: ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`,
    `- Available Liquidity: ${available.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`,
    `- Utilisation: ${utilisation.toFixed(2)}%`,
    `- Variable Borrow Rate: ${formatPercentage(match.variableBorrowRate)}`,
    `- Deposit Rate: ${formatPercentage(match.liquidityRate)}`,
    `- Liquidation Threshold: ${
      match.reserveLiquidationThreshold
        ? `${Number(match.reserveLiquidationThreshold) / 100}%`
        : "n/a"
    }`,
    `- Liquidation Bonus: ${
      match.reserveLiquidationBonus
        ? `${Number(match.reserveLiquidationBonus) / 100}%`
        : "n/a"
    }`,
  ].join("\n");
};

const formatReserveLine = (reserve: AaveUserReserve): string => {
  const decimals = Number.parseInt(reserve.reserve.decimals, 10);
  const collateral = toDecimal(reserve.currentATokenBalance, decimals);
  const debt = toDecimal(reserve.currentTotalDebt, decimals);
  const flags = [
    reserve.usageAsCollateralEnabledOnUser ? "collateral" : undefined,
    debt > 0 ? "debt" : undefined,
  ].filter(Boolean);

  return [
    `${reserve.reserve.symbol}`,
    `  - Collateral: ${collateral.toFixed(6)}`,
    `  - Debt: ${debt.toFixed(6)}`,
    `  - Flags: ${flags.length ? flags.join(", ") : "none"}`,
    `  - Last Update: ${new Date(
      Number.parseInt(reserve.lastUpdateTimestamp, 10) * 1000,
    ).toISOString()}`,
  ].join("\n");
};

export const getUserDataHandler = async (
  args: UserDataInput,
  context: FastMCPContext,
): Promise<string> => {
  if (!args.userAddress) {
    throw new UserError("userAddress is required.");
  }

  const address = args.userAddress.toLowerCase();
  const data = await executeGraphQuery<UserResponse>(context, USER_POSITIONS_QUERY, {
    user: address,
  });

  if (!data.userReserves.length) {
    return `No active Aave positions found for ${address}.`;
  }

  const summary = data.userReserves.map(formatReserveLine).join("\n\n");
  const headline = data.user
    ? formatKeyValue("Account summary", {
        totalCollateralUSD: Number(data.user.totalCollateralUSD ?? 0).toFixed(2),
        totalBorrowsUSD: Number(data.user.totalBorrowsUSD ?? 0).toFixed(2),
        healthFactor: Number(data.user.healthFactor ?? 0).toFixed(4),
      })
    : undefined;

  return [
    `Aave positions for ${address}`,
    headline,
    summary,
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const getUserHealthHandler = async (
  args: UserDataInput,
  context: FastMCPContext,
): Promise<string> => {
  if (!args.userAddress) {
    throw new UserError("userAddress is required.");
  }

  const address = args.userAddress.toLowerCase();
  const data = await executeGraphQuery<UserResponse>(context, USER_POSITIONS_QUERY, {
    user: address,
  });

  const healthFactor = Number(data.user?.healthFactor ?? "0");
  const status = classifyHealthFactor(healthFactor);

  return formatKeyValue(`Aave health factor for ${address}`, {
    healthFactor: healthFactor ? healthFactor.toFixed(4) : "0.0000",
    status,
    totalCollateralUSD: Number(data.user?.totalCollateralUSD ?? "0").toFixed(2),
    totalBorrowsUSD: Number(data.user?.totalBorrowsUSD ?? "0").toFixed(2),
    reservesTracked: data.userReserves.length,
  });
};

export const listAaveNamespacesHandler = async (): Promise<string> => {
  return formatKeyValue("Aave module namespaces", {
    namespace: AAVE_NAMESPACE,
    description: "All Aave data is stored per MCP session.",
  });
};
