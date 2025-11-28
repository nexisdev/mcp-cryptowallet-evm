import { FastMCP } from "fastmcp";
import { z } from "zod";
import { ethers } from "ethers";
import { SessionMetadata } from "../../server/types.js";

const STARGATE_API_BASE = "https://stargate.finance/api/v1";

const RPCS: Record<string, string> = {
    ethereum: "https://eth.llamarpc.com",
    arbitrum: "https://public-arb-mainnet.fastnode.io",
    base: "https://base.llamarpc.com",
    abstract: "https://api.mainnet.abs.xyz",
    ape: "https://rpc.apechain.com",
    bera: "https://rpc.berachain.com",
    botanix: "https://rpc.botanixlabs.com",
    cronosevm: "https://cronos.drpc.org",
    degen: "https://rpc.degen.tips",
    flare: "https://rpc.au.cc/flare",
    fuse: "https://rpc.fuse.io",
    gravity: "https://rpc.gravity.xyz",
    immutable: "https://rpc.immutable.com",
    ink: "https://ink-public.nodies.app",
    kava: "https://evm.kava.io",
    linea: "https://1rpc.io/linea",
    manta: "https://pacific-rpc.manta.network/http",
    mantle: "https://rpc.mantle.xyz",
    merlin: "https://rpc.merlinchain.io",
    metis: "https://metis.api.onfinality.io/public",
    mode: "https://mainnet.mode.network",
    optimism: "https://api.zan.top/opt-mainnet",
    polygon: "https://polygon.lava.build",
    scroll: "https://scroll.drpc.org",
    sei: "https://sei-public.nodies.app",
    taiko: "https://rpc.taiko.xyz",
    xlayer: "https://xlayerrpc.okx.com",
    zircuit: "https://mainnet.zircuit.com",
    zkfair: "https://rpc.zkfair.io",
    zklink: "https://rpc.zklink.io",
    zksync: "https://mainnet.era.zksync.io",
    zora: "https://rpc.zora.energy",
};

export const registerStargateModule = (server: FastMCP<SessionMetadata>) => {
    server.addTool({
        name: "stargate_list_chains",
        description: "List supported chains on Stargate",
        parameters: z.object({}),
        execute: async () => {
            const response = await fetch(`${STARGATE_API_BASE}/chains`);
            if (!response.ok) throw new Error("Failed to fetch chains");
            const data = await response.json();
            return JSON.stringify(data.chains, null, 2);
        },
    });

    server.addTool({
        name: "stargate_list_tokens",
        description: "List bridgeable tokens for a source chain and token",
        parameters: z.object({
            srcChainKey: z.string(),
            srcToken: z.string(),
        }),
        execute: async ({ srcChainKey, srcToken }) => {
            const url = new URL(`${STARGATE_API_BASE}/tokens`);
            url.searchParams.append("srcChainKey", srcChainKey);
            url.searchParams.append("srcToken", srcToken);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error("Failed to fetch tokens");
            const data = await response.json();

            const dsts = data.tokens.filter((t: any) => t.chainKey !== srcChainKey);
            return JSON.stringify(dsts, null, 2);
        },
    });

    server.addTool({
        name: "stargate_get_quotes",
        description: "Get bridge quotes",
        parameters: z.object({
            srcChainKey: z.string(),
            dstChainKey: z.string(),
            srcToken: z.string(),
            dstToken: z.string(),
            srcAmount: z.number(),
            dstAmountMin: z.number(),
            srcAddress: z.string().optional(),
            dstAddress: z.string().optional(),
        }),
        execute: async ({ srcChainKey, dstChainKey, srcToken, dstToken, srcAmount, dstAmountMin, srcAddress, dstAddress }) => {
            // Helper to get token info for decimals
            const getTokenInfo = async (chainKey: string, tokenAddr: string) => {
                const response = await fetch(`${STARGATE_API_BASE}/tokens`);
                if (!response.ok) throw new Error("Failed to fetch tokens");
                const data = await response.json();
                return data.tokens.find((t: any) => t.chainKey.toLowerCase() === chainKey.toLowerCase() && t.address.toLowerCase() === tokenAddr.toLowerCase());
            };

            const srcTokenInfo = await getTokenInfo(srcChainKey, srcToken);
            if (!srcTokenInfo) throw new Error(`Source token not found: ${srcToken}`);
            const srcDecimals = srcTokenInfo.decimals;
            const srcAmountStr = ethers.utils.parseUnits(srcAmount.toString(), srcDecimals).toString();

            const dstTokenInfo = await getTokenInfo(dstChainKey, dstToken);
            if (!dstTokenInfo) throw new Error(`Destination token not found: ${dstToken}`);
            const dstDecimals = dstTokenInfo.decimals;
            const dstAmountMinStr = ethers.utils.parseUnits(dstAmountMin.toString(), dstDecimals).toString();

            let effectiveSrcAddress = srcAddress;
            if (!effectiveSrcAddress && process.env.PRIVATE_KEY) {
                const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
                effectiveSrcAddress = await wallet.getAddress();
            }
            if (!effectiveSrcAddress) throw new Error("srcAddress required or PRIVATE_KEY env var must be set");

            const effectiveDstAddress = dstAddress || effectiveSrcAddress;

            const url = new URL(`${STARGATE_API_BASE}/quotes`);
            url.searchParams.append("srcChainKey", srcChainKey);
            url.searchParams.append("dstChainKey", dstChainKey);
            url.searchParams.append("srcToken", srcToken);
            url.searchParams.append("dstToken", dstToken);
            url.searchParams.append("srcAddress", effectiveSrcAddress);
            url.searchParams.append("dstAddress", effectiveDstAddress);
            url.searchParams.append("srcAmount", srcAmountStr);
            url.searchParams.append("dstAmountMin", dstAmountMinStr);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error("Failed to fetch quotes");
            const data = await response.json();
            return JSON.stringify(data.quotes || [], null, 2);
        },
    });

    server.addTool({
        name: "stargate_bridge",
        description: "Execute bridge transfer",
        parameters: z.object({
            srcChainKey: z.string(),
            dstChainKey: z.string(),
            srcToken: z.string(),
            dstToken: z.string(),
            srcAmount: z.number(),
            dstAmountMin: z.number(),
            dstAddress: z.string().optional(),
        }),
        execute: async ({ srcChainKey, dstChainKey, srcToken, dstToken, srcAmount, dstAmountMin, dstAddress }) => {
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) throw new Error("PRIVATE_KEY environment variable not set.");

            const rpcUrl = RPCS[srcChainKey];
            if (!rpcUrl) throw new Error(`Unsupported source chain: ${srcChainKey}`);

            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const signer = new ethers.Wallet(privateKey, provider);
            const srcAddress = await signer.getAddress();
            const effectiveDstAddress = dstAddress || srcAddress;

            // Re-use logic to get quotes/steps
            // Note: In a real implementation we might want to refactor the quote fetching to a shared function
            // For now, we duplicate the fetch logic or call the internal logic if we structured it that way.
            // I will duplicate for simplicity in this single file.

            const getTokenInfo = async (chainKey: string, tokenAddr: string) => {
                const response = await fetch(`${STARGATE_API_BASE}/tokens`);
                if (!response.ok) throw new Error("Failed to fetch tokens");
                const data = await response.json();
                return data.tokens.find((t: any) => t.chainKey.toLowerCase() === chainKey.toLowerCase() && t.address.toLowerCase() === tokenAddr.toLowerCase());
            };

            const srcTokenInfo = await getTokenInfo(srcChainKey, srcToken);
            if (!srcTokenInfo) throw new Error(`Source token not found: ${srcToken}`);
            const srcDecimals = srcTokenInfo.decimals;
            const srcAmountStr = ethers.utils.parseUnits(srcAmount.toString(), srcDecimals).toString();

            const dstTokenInfo = await getTokenInfo(dstChainKey, dstToken);
            if (!dstTokenInfo) throw new Error(`Destination token not found: ${dstToken}`);
            const dstDecimals = dstTokenInfo.decimals;
            const dstAmountMinStr = ethers.utils.parseUnits(dstAmountMin.toString(), dstDecimals).toString();

            const url = new URL(`${STARGATE_API_BASE}/quotes`);
            url.searchParams.append("srcChainKey", srcChainKey);
            url.searchParams.append("dstChainKey", dstChainKey);
            url.searchParams.append("srcToken", srcToken);
            url.searchParams.append("dstToken", dstToken);
            url.searchParams.append("srcAddress", srcAddress);
            url.searchParams.append("dstAddress", effectiveDstAddress);
            url.searchParams.append("srcAmount", srcAmountStr);
            url.searchParams.append("dstAmountMin", dstAmountMinStr);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error("Failed to fetch quotes");
            const data = await response.json();
            const quotes = data.quotes || [];

            if (quotes.length === 0) throw new Error("No quotes available");
            const quote = quotes[0];
            const steps = quote.steps;

            const txHashes = [];
            for (const step of steps) {
                const txData = step.transaction;
                const tx = {
                    to: txData.to,
                    data: txData.data,
                    value: ethers.BigNumber.from(txData.value || "0"),
                    // gasLimit will be estimated
                };

                const txResponse = await signer.sendTransaction(tx);
                await txResponse.wait();
                txHashes.push(txResponse.hash);
            }

            return JSON.stringify({
                success: true,
                txHashes,
                _summary: `Bridge transfer initiated. Txs: ${txHashes.join(", ")}`,
            }, null, 2);
        },
    });
};
