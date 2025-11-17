import { UserError } from "fastmcp";
import { ethers } from "ethers";
import { formatKeyValue, getProvider, getWallet, setProvider } from "../wallet/utils.js";
import { BSC_DEFAULT_PROVIDER_URL, BSC_NAMESPACE } from "./constants.js";

const ERC20_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export const setBscProviderHandler = async (
  params: { providerURL: string },
  context: Parameters<typeof setProvider>[0],
): Promise<string> => {
  if (!params.providerURL) {
    throw new UserError("providerURL is required for BSC provider configuration.");
  }

  const { url } = await setProvider(context, params.providerURL, BSC_NAMESPACE);
  return formatKeyValue("BSC provider configured", { url });
};

export const transferNativeHandler = async (
  params: {
    wallet?: string;
    password?: string;
    to: string;
    amount: string;
    gasPrice?: string;
  },
  context: Parameters<typeof getWallet>[0],
): Promise<string> => {
  try {
    const signer = await getWallet(context, params.wallet, params.password, BSC_NAMESPACE);
    const value = ethers.utils.parseEther(params.amount);
    const overrides: ethers.providers.TransactionRequest = {
      to: params.to,
      value,
    };

    if (params.gasPrice) {
      overrides.gasPrice = ethers.utils.parseUnits(params.gasPrice, "gwei");
    }

    const response = await signer.sendTransaction(overrides);
    const receipt = await response.wait();

    return formatKeyValue("BSC transfer broadcast", {
      hash: response.hash,
      status: receipt?.status ?? "unknown",
      nonce: response.nonce,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to send BNB transfer: ${message}`);
  }
};

export const transferTokenHandler = async (
  params: {
    wallet?: string;
    password?: string;
    tokenAddress: string;
    to: string;
    amount: string;
    decimals?: number;
    gasPrice?: string;
  },
  context: Parameters<typeof getWallet>[0],
): Promise<string> => {
  try {
    const signer = await getWallet(context, params.wallet, params.password, BSC_NAMESPACE);
    const contract = new ethers.Contract(params.tokenAddress, ERC20_ABI, signer);

    const decimals: number =
      params.decimals ??
      (await contract
        .decimals()
        .then((bn: ethers.BigNumber) => bn.toNumber())
        .catch(() => 18));
    const value = ethers.utils.parseUnits(params.amount, decimals);

    const transactionOverrides: ethers.PayableOverrides = {};
    if (params.gasPrice) {
      transactionOverrides.gasPrice = ethers.utils.parseUnits(params.gasPrice, "gwei");
    }

    const tx = await contract.transfer(params.to, value, transactionOverrides);
    const receipt = await tx.wait();

    return formatKeyValue("BEP-20 transfer broadcast", {
      hash: tx.hash,
      status: receipt?.status ?? "unknown",
      amount: params.amount,
      decimals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to transfer BEP-20 token: ${message}`);
  }
};

export const tokenBalanceHandler = async (
  params: { owner: string; tokenAddress: string },
  context: Parameters<typeof getProvider>[0],
): Promise<string> => {
  try {
    const provider = getProvider(context, BSC_DEFAULT_PROVIDER_URL, BSC_NAMESPACE);
    const contract = new ethers.Contract(params.tokenAddress, ERC20_ABI, provider);

    const [balance, decimalsResult] = await Promise.all([
      contract.balanceOf(params.owner) as Promise<ethers.BigNumber>,
      contract.decimals().then((bn: ethers.BigNumber) => bn.toNumber()).catch(() => 18) as Promise<number>,
    ]);

    const decimals: number = decimalsResult;

    return formatKeyValue("BEP-20 balance", {
      owner: params.owner,
      tokenAddress: params.tokenAddress,
      raw: balance.toString(),
      formatted: ethers.utils.formatUnits(balance, decimals),
      decimals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to fetch BEP-20 balance: ${message}`);
  }
};
