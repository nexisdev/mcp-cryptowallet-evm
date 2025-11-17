export const AAVE_NAMESPACE = "aave";
export const DEFAULT_SUBGRAPH_URL =
  process.env.AAVE_SUBGRAPH_URL ??
  "https://gateway.thegraph.com/api/subgraphs/id/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g";
export const DEFAULT_CACHE_TTL_MS = Number.parseInt(
  process.env.AAVE_CACHE_TTL_MS ?? `${5 * 60 * 1000}`,
  10,
);
