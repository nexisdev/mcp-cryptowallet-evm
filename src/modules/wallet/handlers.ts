import { UserError } from "fastmcp";
import { ethers } from "ethers";
import { generateMnemonic } from "@scure/bip39";
import { formatKeyValue, getProvider, getWallet, setProvider } from "./utils.js";
import type { ServerContext } from "../../server/types.js";

type WalletContext = ServerContext;
type TypedDataFields = Record<string, Array<{ name: string; type: string }>>;

const ensureWalletProvider = (wallet: ethers.Wallet): ethers.providers.Provider => {
  if (!wallet.provider) {
    throw new UserError(
      "Provider not configured. Call wallet_provider_set before invoking this tool.",
    );
  }
  return wallet.provider;
};

const progress = async (
  context: WalletContext,
  current: number,
  total = 100,
): Promise<void> => {
  await context.reportProgress({ progress: current, total });
};

const stringifyBigNumber = (value: ethers.BigNumberish | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  try {
    return ethers.BigNumber.from(value).toString();
  } catch {
    return String(value);
  }
};

export const setProviderHandler = async (
  params: { providerURL: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.providerURL) {
    throw new UserError("providerURL is required.");
  }

  await progress(context, 10);
  const { url } = await setProvider(context, params.providerURL);
  await progress(context, 100);

  return formatKeyValue("Provider configured", { url });
};

export const createWalletHandler = async (
  params: {
    password?: string;
    path?: string;
    locale?: string;
  },
  context: WalletContext,
): Promise<string> => {
  context.log.info("[wallet] Creating random wallet");
  await progress(context, 10);

  const options: Record<string, unknown> = {};
  if (params.path) {
    options.path = params.path;
  }
  if (params.locale) {
    options.locale = params.locale;
  }

  const wallet = ethers.Wallet.createRandom(options);
  await progress(context, 40);

  let encryptedWallet: string | undefined;
  if (params.password) {
    encryptedWallet = await wallet.encrypt(params.password);
    await progress(context, 70);
  }

  await progress(context, 100);
  return formatKeyValue("Wallet created", {
    address: wallet.address,
    mnemonic: wallet.mnemonic?.phrase,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    encryptedWallet: encryptedWallet ? "yes" : "no",
  });
};

export const fromPrivateKeyHandler = async (
  params: { privateKey: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.privateKey) {
    throw new UserError("privateKey is required.");
  }

  const provider = getProvider(context);
  const wallet = new ethers.Wallet(params.privateKey, provider);

  return formatKeyValue("Wallet imported from private key", {
    address: wallet.address,
    publicKey: wallet.publicKey,
  });
};

export const createMnemonicPhraseHandler = async (
  params: { locale?: string; length?: 12 | 15 | 18 | 21 | 24 },
  context: WalletContext,
): Promise<string> => {
  const locale = params.locale ?? "english";
  const length = params.length ?? 12;
  const entropyBits = (length / 3) * 32;

  context.log.info("[wallet] Generating mnemonic", { locale, length });
  const { wordlist } = await import(`@scure/bip39/wordlists/${locale}.js`).catch(() => {
    throw new UserError(`Unsupported locale '${locale}'.`);
  });

  const mnemonic = generateMnemonic(wordlist, entropyBits);
  return formatKeyValue("Mnemonic phrase generated", {
    mnemonic,
    locale,
    length,
  });
};

export const fromMnemonicHandler = async (
  params: { mnemonic: string; path?: string; locale?: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.mnemonic) {
    throw new UserError("mnemonic is required.");
  }

  const provider = getProvider(context);
  const wallet = ethers.Wallet.fromMnemonic(
    params.mnemonic,
    params.path,
    params.locale ? ethers.wordlists[params.locale] : undefined,
  ).connect(provider);

  return formatKeyValue("Wallet imported from mnemonic", {
    address: wallet.address,
    publicKey: wallet.publicKey,
    path: params.path ?? "default",
  });
};

export const fromEncryptedJsonHandler = async (
  params: { json: string; password: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.json || !params.password) {
    throw new UserError("json and password are required.");
  }

  const provider = getProvider(context);
  const wallet = await ethers.Wallet.fromEncryptedJson(params.json, params.password);
  wallet.connect(provider);

  return formatKeyValue("Wallet decrypted from JSON", {
    address: wallet.address,
    publicKey: wallet.publicKey,
  });
};

export const encryptWalletHandler = async (
  params: { wallet?: string; password: string; options?: Record<string, unknown> },
  context: WalletContext,
): Promise<string> => {
  if (!params.password) {
    throw new UserError("password is required.");
  }

  const wallet = await getWallet(context, params.wallet, params.password);
  const encryptedWallet = await wallet.encrypt(params.password, params.options);

  return formatKeyValue("Wallet encrypted", {
    address: wallet.address,
    encryptedWallet,
  });
};

export const getAddressHandler = async (
  params: { wallet?: string },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet);
  return formatKeyValue("Wallet address", { address: wallet.address });
};

export const getPublicKeyHandler = async (
  params: { wallet?: string },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet);
  return formatKeyValue("Wallet public key", { publicKey: wallet.publicKey });
};

export const getPrivateKeyHandler = async (
  params: { wallet?: string; password?: string },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet, params.password);
  return formatKeyValue("Wallet private key", { privateKey: wallet.privateKey });
};

export const getMnemonicHandler = async (
  params: { wallet?: string; password?: string },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet, params.password);
  const mnemonic = wallet.mnemonic;

  if (!mnemonic?.phrase) {
    throw new UserError(
      "Mnemonic is unavailable for this wallet. Import the wallet from a mnemonic or encrypted JSON that preserves the phrase.",
    );
  }

  return formatKeyValue("Wallet mnemonic", {
    phrase: mnemonic.phrase,
    path: mnemonic.path,
    locale: mnemonic.locale,
  });
};

export const getBalanceHandler = async (
  params: { wallet?: string; password?: string; blockTag?: ethers.providers.BlockTag },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet, params.password);
  await progress(context, 20);
  const balance = await wallet.getBalance(params.blockTag ?? "latest");
  await progress(context, 100);

  return formatKeyValue("Wallet balance", {
    raw: balance.toString(),
    ether: ethers.utils.formatEther(balance),
    blockTag: params.blockTag ?? "latest",
  });
};

export const getChainIdHandler = async (
  params: { wallet?: string; password?: string },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet, params.password);
  const chainId = await wallet.getChainId();

  return formatKeyValue("Chain ID", { chainId });
};

export const getGasPriceHandler = async (
  params: { wallet?: string; password?: string },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet, params.password);
  const gasPrice = await wallet.getGasPrice();

  return formatKeyValue("Gas price", {
    wei: gasPrice.toString(),
    gwei: ethers.utils.formatUnits(gasPrice, "gwei"),
  });
};

export const getTransactionCountHandler = async (
  params: { wallet?: string; password?: string; blockTag?: ethers.providers.BlockTag },
  context: WalletContext,
): Promise<string> => {
  const wallet = await getWallet(context, params.wallet, params.password);
  const txCount = await wallet.getTransactionCount(params.blockTag);

  return formatKeyValue("Transaction count", {
    count: txCount,
    blockTag: params.blockTag ?? "latest",
  });
};

export const callHandler = async (
  params: {
    wallet?: string;
    password?: string;
    transaction: ethers.providers.TransactionRequest;
    blockTag?: ethers.providers.BlockTag;
  },
  context: WalletContext,
): Promise<string> => {
  if (!params.transaction) {
    throw new UserError("transaction object is required.");
  }

  const wallet = await getWallet(context, params.wallet, params.password);
  const provider = ensureWalletProvider(wallet);
  const result = await provider.call(params.transaction, params.blockTag);

  return formatKeyValue("Contract call result", { result });
};

export const sendTransactionHandler = async (
  params: {
    wallet?: string;
    password?: string;
    transaction: ethers.providers.TransactionRequest;
  },
  context: WalletContext,
): Promise<string> => {
  if (!params.transaction) {
    throw new UserError("transaction object is required.");
  }

  const wallet = await getWallet(context, params.wallet, params.password);
  ensureWalletProvider(wallet);

  await progress(context, 10);
  const response = await wallet.sendTransaction(params.transaction);
  await progress(context, 60);
  const receipt = await response.wait();
  await progress(context, 100);

  return formatKeyValue("Transaction sent", {
    hash: response.hash,
    nonce: response.nonce,
    gasLimit: stringifyBigNumber(response.gasLimit),
    gasPrice: stringifyBigNumber(response.gasPrice),
    status: receipt?.status,
    confirmations: receipt?.confirmations,
  });
};

export const signTransactionHandler = async (
  params: {
    wallet?: string;
    password?: string;
    transaction: ethers.providers.TransactionRequest;
  },
  context: WalletContext,
): Promise<string> => {
  if (!params.transaction) {
    throw new UserError("transaction object is required.");
  }

  const wallet = await getWallet(context, params.wallet, params.password);
  await progress(context, 40);
  const populated = await wallet.populateTransaction(params.transaction);
  await progress(context, 70);
  const signature = await wallet.signTransaction(populated);
  await progress(context, 100);

  return formatKeyValue("Transaction signed", {
    signature,
    to: populated.to,
    value: populated.value?.toString(),
  });
};

export const populateTransactionHandler = async (
  params: {
    wallet?: string;
    password?: string;
    transaction: ethers.providers.TransactionRequest;
  },
  context: WalletContext,
): Promise<string> => {
  if (!params.transaction) {
    throw new UserError("transaction object is required.");
  }

  const wallet = await getWallet(context, params.wallet, params.password);
  ensureWalletProvider(wallet);
  const populated = await wallet.populateTransaction(params.transaction);

  return formatKeyValue("Transaction populated", {
    to: populated.to,
    from: populated.from,
    nonce: populated.nonce,
    gasLimit: stringifyBigNumber(populated.gasLimit),
    gasPrice: stringifyBigNumber(populated.gasPrice),
    data: populated.data ? `${(populated.data as string).slice(0, 66)}...` : undefined,
  });
};

export const signMessageHandler = async (
  params: { wallet?: string; password?: string; message: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.message) {
    throw new UserError("message is required.");
  }

  const wallet = await getWallet(context, params.wallet, params.password);
  const signature = await wallet.signMessage(params.message);

  return formatKeyValue("Message signed", {
    signature,
    message: params.message,
  });
};

export const signTypedDataHandler = async (
  params: {
    wallet?: string;
    password?: string;
    domain: Record<string, unknown>;
    types: TypedDataFields;
    value: Record<string, unknown>;
  },
  context: WalletContext,
): Promise<string> => {
  if (!params.domain || !params.types || !params.value) {
    throw new UserError("domain, types, and value are required.");
  }

  const wallet = await getWallet(context, params.wallet, params.password);
  const signer = wallet as ethers.Wallet & {
    _signTypedData: (
      domain: Record<string, unknown>,
      types: TypedDataFields,
      value: Record<string, unknown>,
    ) => Promise<string>;
  };

  const signature = await signer._signTypedData(
    params.domain,
    params.types,
    params.value,
  );

  return formatKeyValue("Typed data signed", {
    signature,
    domain: JSON.stringify(params.domain),
  });
};

export const verifyMessageHandler = async (
  params: { message: string; signature: string; address: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.message || !params.signature || !params.address) {
    throw new UserError("message, signature, and address are required.");
  }

  const recovered = ethers.utils.verifyMessage(params.message, params.signature);
  const isValid = recovered.toLowerCase() === params.address.toLowerCase();

  context.log.info("[wallet] Message verification complete", { isValid });
  return formatKeyValue("Message verification", {
    isValid,
    recoveredAddress: recovered,
  });
};

export const verifyTypedDataHandler = async (
  params: {
    domain: Record<string, unknown>;
    types: TypedDataFields;
    value: Record<string, unknown>;
    signature: string;
    address: string;
  },
  context: WalletContext,
): Promise<string> => {
  if (!params.domain || !params.types || !params.value || !params.signature || !params.address) {
    throw new UserError(
      "domain, types, value, signature, and address are required for verification.",
    );
  }

  const recovered = ethers.utils.verifyTypedData(params.domain, params.types, params.value, params.signature);
  const isValid = recovered.toLowerCase() === params.address.toLowerCase();

  return formatKeyValue("Typed data verification", {
    isValid,
    recoveredAddress: recovered,
  });
};

export const getBlockHandler = async (
  params: { blockHashOrBlockTag: ethers.providers.BlockTag; includeTransactions?: boolean },
  context: WalletContext,
): Promise<string> => {
  if (!params.blockHashOrBlockTag) {
    throw new UserError("blockHashOrBlockTag is required.");
  }

  const provider = getProvider(context);
  const block = await (provider as unknown as {
    getBlock: (
      blockHashOrBlockTag: ethers.providers.BlockTag,
      includeTransactions?: boolean,
    ) => Promise<ethers.providers.Block | null>;
  }).getBlock(params.blockHashOrBlockTag, params.includeTransactions);

  return formatKeyValue("Block data", {
    hash: block?.hash,
    number: block?.number,
    timestamp: block?.timestamp,
    transactionCount: block?.transactions?.length,
  });
};

export const getTransactionHandler = async (
  params: { transactionHash: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.transactionHash) {
    throw new UserError("transactionHash is required.");
  }

  const provider = getProvider(context);
  const transaction = await provider.getTransaction(params.transactionHash);

  if (!transaction) {
    throw new UserError("Transaction not found.");
  }

  return formatKeyValue("Transaction details", {
    hash: transaction.hash,
    from: transaction.from,
    to: transaction.to,
    nonce: transaction.nonce,
    gasPrice: stringifyBigNumber(transaction.gasPrice),
    value: stringifyBigNumber(transaction.value),
  });
};

export const getTransactionReceiptHandler = async (
  params: { transactionHash: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.transactionHash) {
    throw new UserError("transactionHash is required.");
  }

  const provider = getProvider(context);
  const receipt = await provider.getTransactionReceipt(params.transactionHash);

  if (!receipt) {
    throw new UserError("Transaction receipt not found.");
  }

  return formatKeyValue("Transaction receipt", {
    status: receipt.status,
    blockNumber: receipt.blockNumber,
    gasUsed: stringifyBigNumber(receipt.gasUsed),
    cumulativeGasUsed: stringifyBigNumber(receipt.cumulativeGasUsed),
    logs: receipt.logs.length,
  });
};

export const getCodeHandler = async (
  params: { address: string; blockTag?: ethers.providers.BlockTag },
  context: WalletContext,
): Promise<string> => {
  if (!params.address) {
    throw new UserError("address is required.");
  }

  const provider = getProvider(context);
  const code = await provider.getCode(params.address, params.blockTag);

  return formatKeyValue("Contract bytecode", {
    address: params.address,
    length: code.length,
    preview: code.slice(0, 66),
  });
};

export const getStorageAtHandler = async (
  params: { address: string; position: ethers.BigNumberish; blockTag?: ethers.providers.BlockTag },
  context: WalletContext,
): Promise<string> => {
  if (!params.address) {
    throw new UserError("address is required.");
  }

  const provider = getProvider(context);
  const storage = await provider.getStorageAt(
    params.address,
    params.position,
    params.blockTag,
  );

  return formatKeyValue("Storage slot value", {
    address: params.address,
    position: params.position?.toString(),
    data: storage,
  });
};

export const estimateGasHandler = async (
  params: { transaction: ethers.providers.TransactionRequest },
  context: WalletContext,
): Promise<string> => {
  if (!params.transaction) {
    throw new UserError("transaction object is required.");
  }

  const provider = getProvider(context);
  const estimate = await provider.estimateGas(params.transaction);

  return formatKeyValue("Gas estimate", {
    gasUnits: estimate.toString(),
  });
};

export const getLogsHandler = async (
  params: { filter: ethers.providers.Filter },
  context: WalletContext,
): Promise<string> => {
  if (!params.filter) {
    throw new UserError("filter is required.");
  }

  const provider = getProvider(context);
  const logs = await provider.getLogs(params.filter);

  return formatKeyValue("Log query", {
    matches: logs.length,
    firstLog: logs[0]?.transactionHash,
  });
};

export const getEnsResolverHandler = async (
  params: { name: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.name) {
    throw new UserError("name is required.");
  }

  const provider = getProvider(context);
  const resolver = await (provider as ethers.providers.BaseProvider & {
    getResolver: (name: string) => Promise<{ address: string } | null>;
  }).getResolver(params.name);

  if (!resolver) {
    throw new UserError(`No resolver configured for ${params.name}.`);
  }

  return formatKeyValue("ENS resolver", {
    name: params.name,
    resolver: resolver.address,
  });
};

export const lookupAddressHandler = async (
  params: { address: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.address) {
    throw new UserError("address is required.");
  }

  const provider = getProvider(context);
  const name = await provider.lookupAddress(params.address);

  if (!name) {
    throw new UserError("No ENS name found for this address.");
  }

  return formatKeyValue("ENS name", {
    address: params.address,
    name,
  });
};

export const resolveNameHandler = async (
  params: { name: string },
  context: WalletContext,
): Promise<string> => {
  if (!params.name) {
    throw new UserError("name is required.");
  }

  const provider = getProvider(context);
  const address = await provider.resolveName(params.name);

  if (!address) {
    throw new UserError("ENS name could not be resolved.");
  }

  return formatKeyValue("ENS address", {
    name: params.name,
    address,
  });
};

export const getNetworkHandler = async (
  _params: Record<string, never>,
  context: WalletContext,
): Promise<string> => {
  const provider = getProvider(context);
  const network = await provider.getNetwork();

  return formatKeyValue("Network information", {
    name: network.name,
    chainId: network.chainId,
    ensAddress: network.ensAddress ?? "n/a",
  });
};

export const getBlockNumberHandler = async (
  _params: Record<string, never>,
  context: WalletContext,
): Promise<string> => {
  const provider = getProvider(context);
  const blockNumber = await provider.getBlockNumber();

  return formatKeyValue("Current block number", {
    blockNumber,
  });
};

export const getFeeDataHandler = async (
  _params: Record<string, never>,
  context: WalletContext,
): Promise<string> => {
  const provider = getProvider(context);
  const feeData = await provider.getFeeData();

  return formatKeyValue("Fee data", {
    gasPrice: feeData.gasPrice ? stringifyBigNumber(feeData.gasPrice) : undefined,
    maxFeePerGas: feeData.maxFeePerGas ? stringifyBigNumber(feeData.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      ? stringifyBigNumber(feeData.maxPriorityFeePerGas)
      : undefined,
  });
};
