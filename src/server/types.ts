import type { Context } from "fastmcp";
import type { StorageProvider } from "../core/storage.js";

export type UsageTier = "free" | "pro" | "ultra";

export type SessionMetadata = {
  userId?: string;
  organizationId?: string;
  tier: UsageTier;
  storage: StorageProvider;
  issuedAt: number;
};

export type ServerContext = Context<SessionMetadata>;
