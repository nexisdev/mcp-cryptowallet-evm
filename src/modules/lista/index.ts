import { FastMCP } from "fastmcp";
import { z } from "zod";
import { ethers } from "ethers";
import { SessionMetadata } from "../../server/types.js";

export const registerListaModule = (server: FastMCP<SessionMetadata>) => {
    server.addTool({
        name: "lista_list_vaults",
        description: "List vaults for a given zone on Lista DAO",
        parameters: z.object({
            zone: z.enum(["classic", "alpha", "aster"]).default("classic"),
        }),
        execute: async ({ zone }) => {
            const zoneMap = { classic: 0, alpha: 1, aster: 4 };
            const zoneNum = zoneMap[zone];

            const url = `https://api.lista.org/api/moolah/vault/list?sort=depositsUsd&order=desc&keyword=&zone=${zoneNum}&chain=bsc,ethereum`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.code !== "000000000") {
                throw new Error(data.msg || "API error");
            }

            const vaults = data.data.list.map((v: any) => ({
                name: v.name,
                chain: v.chain,
                address: v.address,
                assetSymbol: v.assetSymbol,
                deposits: parseFloat(v.deposits),
                depositsUsd: parseFloat(v.depositsUsd),
                utilization: parseFloat(v.utilization),
                apy: parseFloat(v.apy),
                curator: v.curator,
            }));

            return JSON.stringify({
                vaults,
                _summary: `Found ${vaults.length} vaults in ${zone} zone. Top vault: ${vaults[0]?.name} ($${vaults[0]?.depositsUsd.toFixed(2)})`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "lista_deposit",
        description: "Deposit assets to a Lista vault",
        parameters: z.object({
            vaultAddress: z.string().describe("Vault contract address"),
            assetAmount: z.number().describe("Amount of asset to deposit"),
            receiverAddress: z.string().optional().describe("Address to receive the vault shares"),
        }),
        execute: async ({ vaultAddress, assetAmount, receiverAddress }) => {
            const rpcUrl = process.env.RPC_URL || "https://bsc-dataseed.binance.org/";
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                throw new Error("PRIVATE_KEY environment variable not set. Required for signing transactions.");
            }
            const signer = new ethers.Wallet(privateKey, provider);

            const vaultABI = [
                "function asset() view returns (address)",
                "function previewDeposit(uint256 assets) view returns (uint256 shares)",
                "function deposit(uint256 assets, address receiver) nonpayable returns (uint256 shares)",
            ];

            const erc20ABI = [
                "function allowance(address _owner, address _spender) view returns (uint256)",
                "function approve(address _spender, uint256 _value) nonpayable returns (bool)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)",
            ];

            const vault = new ethers.Contract(vaultAddress, vaultABI, signer);
            const assetAddress = await vault.asset();
            const asset = new ethers.Contract(assetAddress, erc20ABI, signer);

            const decimals = await asset.decimals();
            const amount = ethers.utils.parseUnits(assetAmount.toString(), decimals);
            const previewShares = await vault.previewDeposit(amount);

            const signerAddress = await signer.getAddress();
            const allowance = await asset.allowance(signerAddress, vaultAddress);

            let approveTxHash = null;
            if (allowance.lt(amount)) {
                const approveTx = await asset.approve(vaultAddress, amount);
                approveTxHash = approveTx.hash;
                await approveTx.wait();
            }

            const effectiveReceiver = receiverAddress || signerAddress;

            const depositTx = await vault.deposit(amount, effectiveReceiver, { gasLimit: 500000 });
            await depositTx.wait();

            return JSON.stringify({
                success: true,
                txHash: depositTx.hash,
                sharesMinted: parseFloat(ethers.utils.formatUnits(previewShares, decimals)), // Approximation, shares decimals might differ but usually 18 or same as asset
                approveTxHash,
                _summary: `Deposited ${assetAmount} to vault ${vaultAddress}. Tx: ${depositTx.hash}`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "lista_redeem",
        description: "Redeem vault shares for underlying assets",
        parameters: z.object({
            vaultAddress: z.string().describe("Vault contract address"),
            shareAmount: z.number().describe("Amount of shares to redeem"),
            receiverAddress: z.string().optional().describe("Address to receive the assets (defaults to signer)"),
            ownerAddress: z.string().optional().describe("Owner of the shares (defaults to signer)"),
        }),
        execute: async ({ vaultAddress, shareAmount, receiverAddress, ownerAddress }) => {
            const rpcUrl = process.env.RPC_URL || "https://bsc-dataseed.binance.org/";
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                throw new Error("PRIVATE_KEY environment variable not set.");
            }
            const signer = new ethers.Wallet(privateKey, provider);
            const signerAddress = await signer.getAddress();

            const effectiveReceiver = receiverAddress || signerAddress;
            const effectiveOwner = ownerAddress || signerAddress;

            const vaultABI = [
                "function decimals() view returns (uint8)",
                "function asset() view returns (address)",
                "function previewRedeem(uint256 shares) view returns (uint256 assets)",
                "function redeem(uint256 shares, address receiver, address owner) nonpayable returns (uint256 assets)",
            ];

            const vault = new ethers.Contract(vaultAddress, vaultABI, signer);
            const decimals = await vault.decimals();
            const amount = ethers.utils.parseUnits(shareAmount.toString(), decimals);
            const previewAssets = await vault.previewRedeem(amount);

            if (effectiveOwner.toLowerCase() !== signerAddress.toLowerCase()) {
                throw new Error("Owner must be the signer address for this implementation.");
            }

            const redeemTx = await vault.redeem(amount, effectiveReceiver, effectiveOwner, { gasLimit: 500000 });
            await redeemTx.wait();

            return JSON.stringify({
                success: true,
                txHash: redeemTx.hash,
                assetsReceived: parseFloat(ethers.utils.formatUnits(previewAssets, decimals)),
                _summary: `Redeemed ${shareAmount} shares from vault ${vaultAddress}. Tx: ${redeemTx.hash}`,
            }, null, 2);
        },
    });

    server.addTool({
        name: "lista_withdraw",
        description: "Withdraw assets from a Lista vault",
        parameters: z.object({
            vaultAddress: z.string().describe("Vault contract address"),
            assetAmount: z.number().describe("Amount of assets to withdraw"),
            receiverAddress: z.string().optional().describe("Address to receive the assets (defaults to signer)"),
            ownerAddress: z.string().optional().describe("Owner of the shares (defaults to signer)"),
        }),
        execute: async ({ vaultAddress, assetAmount, receiverAddress, ownerAddress }) => {
            const rpcUrl = process.env.RPC_URL || "https://bsc-dataseed.binance.org/";
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                throw new Error("PRIVATE_KEY environment variable not set.");
            }
            const signer = new ethers.Wallet(privateKey, provider);
            const signerAddress = await signer.getAddress();

            const effectiveReceiver = receiverAddress || signerAddress;
            const effectiveOwner = ownerAddress || signerAddress;

            const vaultABI = [
                "function asset() view returns (address)",
                "function previewWithdraw(uint256 assets) view returns (uint256 shares)",
                "function withdraw(uint256 assets, address receiver, address owner) nonpayable returns (uint256 shares)",
            ];

            const erc20ABI = [
                "function decimals() view returns (uint8)",
            ];

            const vault = new ethers.Contract(vaultAddress, vaultABI, signer);
            const assetAddress = await vault.asset();
            const asset = new ethers.Contract(assetAddress, erc20ABI, signer);

            const decimals = await asset.decimals();
            const amount = ethers.utils.parseUnits(assetAmount.toString(), decimals);
            const previewShares = await vault.previewWithdraw(amount);

            if (effectiveOwner.toLowerCase() !== signerAddress.toLowerCase()) {
                throw new Error("Owner must be the signer address for this implementation.");
            }

            const withdrawTx = await vault.withdraw(amount, effectiveReceiver, effectiveOwner, { gasLimit: 500000 });
            await withdrawTx.wait();

            return JSON.stringify({
                success: true,
                txHash: withdrawTx.hash,
                sharesBurned: parseFloat(ethers.utils.formatUnits(previewShares, decimals)),
                _summary: `Withdrew ${assetAmount} assets from vault ${vaultAddress}. Tx: ${withdrawTx.hash}`,
            }, null, 2);
        },
    });
};
