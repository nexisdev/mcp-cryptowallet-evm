export const WORMHOLE_NAMESPACE = "wormhole";
export const WORMHOLE_DEFAULT_ENDPOINT =
  process.env.WORMHOLE_ENDPOINT ?? "https://api.testnet.wormhole.com";
export const WORMHOLE_SUPPORTED_CHAINS = [
  { id: "ethereum", label: "Ethereum Mainnet" },
  { id: "bsc", label: "BNB Smart Chain" },
  { id: "polygon", label: "Polygon PoS" },
  { id: "solana", label: "Solana Mainnet" },
];

