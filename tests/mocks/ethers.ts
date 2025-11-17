// @ts-nocheck
import { jest } from "@jest/globals";

const createBigNumber = (value: string) => ({
  toString: () => value,
});

const providerMock = {
  getBalance: jest.fn().mockResolvedValue(createBigNumber("1000000000000000000")),
  getBlock: jest.fn().mockResolvedValue({ hash: "0xblock", number: 1, timestamp: 0, transactions: [] }),
  getTransaction: jest.fn().mockResolvedValue({
    hash: "0xtx",
    from: "0xfrom",
    to: "0xto",
    nonce: 1,
    gasPrice: createBigNumber("1000000000"),
    value: createBigNumber("0"),
  }),
  getTransactionReceipt: jest.fn().mockResolvedValue({
    status: 1,
    blockNumber: 1,
    gasUsed: createBigNumber("21000"),
    cumulativeGasUsed: createBigNumber("21000"),
    logs: [],
  }),
  getCode: jest.fn().mockResolvedValue("0x"),
  getStorageAt: jest.fn().mockResolvedValue("0x0"),
  estimateGas: jest.fn().mockResolvedValue(createBigNumber("21000")),
  getLogs: jest.fn().mockResolvedValue([]),
  getNetwork: jest.fn().mockResolvedValue({ name: "binance", chainId: 56 }),
  getBlockNumber: jest.fn().mockResolvedValue(1),
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: createBigNumber("1000000000"),
    maxFeePerGas: createBigNumber("1000000000"),
    maxPriorityFeePerGas: createBigNumber("1000000000"),
  }),
  call: jest.fn().mockResolvedValue("0x"),
  getResolver: jest.fn().mockResolvedValue({ address: "0xresolver" }),
  lookupAddress: jest.fn().mockResolvedValue("example.eth"),
  resolveName: jest.fn().mockResolvedValue("0xresolved"),
};

export const __walletMocks = {
  sendTransaction: jest.fn().mockResolvedValue({
    hash: "0xhash",
    nonce: 1,
    wait: jest.fn().mockResolvedValue({ status: 1 }),
  }),
  populateTransaction: jest.fn().mockResolvedValue({
    to: "0xto",
    from: "0xfrom",
    nonce: 1,
    gasLimit: createBigNumber("21000"),
    gasPrice: createBigNumber("1000000000"),
    value: createBigNumber("0"),
    data: "0x",
  }),
  signTransaction: jest.fn().mockResolvedValue("0xsigned"),
  signMessage: jest.fn().mockResolvedValue("0xsignature"),
  _signTypedData: jest.fn().mockResolvedValue("0xtypedsignature"),
};

class MockWallet {
  address = "0xwallet";
  provider: any;
  mnemonic?: { phrase: string; path: string; locale: string };
  sendTransaction = __walletMocks.sendTransaction;
  populateTransaction = __walletMocks.populateTransaction;
  signTransaction = __walletMocks.signTransaction;
  signMessage = __walletMocks.signMessage;
  connect = jest.fn().mockReturnThis();
  _signTypedData = __walletMocks._signTypedData;

  constructor(_privateKey?: string, provider?: any) {
    this.provider = provider ?? providerMock;
  }

  async encrypt(): Promise<string> {
    return JSON.stringify({ address: this.address });
  }

  async getBalance(): Promise<any> {
    return createBigNumber("1000000000000000000");
  }

  async getChainId(): Promise<number> {
    return 56;
  }

  async getGasPrice(): Promise<any> {
    return createBigNumber("1000000000");
  }

  async getTransactionCount(): Promise<number> {
    return 5;
  }
}

export const __contractMocks = {
  transfer: jest.fn().mockResolvedValue({
    hash: "0xtokentransfer",
    wait: jest.fn().mockResolvedValue({ status: 1 }),
  }),
  balanceOf: jest.fn().mockResolvedValue(createBigNumber("100000000")),
  decimals: jest.fn().mockResolvedValue(18),
};

class MockContract {
  constructor(_address: string, _abi: unknown, _signerOrProvider?: any) {}

  transfer = __contractMocks.transfer;
  balanceOf = __contractMocks.balanceOf;
  decimals = __contractMocks.decimals;
}

export const __ethersMockState = {
  provider: providerMock,
};

export const providers = {
  JsonRpcProvider: jest.fn(() => providerMock),
};

export const utils = {
  parseEther: jest.fn((value: string) => createBigNumber(value)),
  parseUnits: jest.fn((value: string, decimals?: number) =>
    createBigNumber(`${value}:${decimals ?? 18}`),
  ),
  formatUnits: jest.fn((value: { toString: () => string }, decimals: number) =>
    `${value.toString()}:${decimals}`,
  ),
  formatEther: jest.fn(() => "1.0"),
  verifyMessage: jest.fn(() => "0xabc"),
  verifyTypedData: jest.fn(() => "0xabc"),
};

export const BigNumber = {
  from: jest.fn((value: string) => createBigNumber(value)),
};

export const wordlists = {
  en: {},
};

export const Wallet = MockWallet as unknown as typeof MockWallet & {
  createRandom: jest.Mock;
  fromMnemonic: jest.Mock;
  fromEncryptedJson: jest.Mock;
};

(Wallet as any).createRandom = jest.fn(() => {
  const wallet = new MockWallet();
  wallet.mnemonic = {
    phrase: "test test test test test test test test test test test junk",
    path: "m/44'/60'/0'/0/0",
    locale: "en",
  };
  return wallet;
});
(Wallet as any).fromMnemonic = jest.fn((mnemonic: string) => {
  const wallet = new MockWallet();
  wallet.mnemonic = {
    phrase: mnemonic,
    path: "m/44'/60'/0'/0/0",
    locale: "en",
  };
  return wallet;
});
(Wallet as any).fromEncryptedJson = jest.fn(async () => new MockWallet());

export const Contract = MockContract as unknown as typeof MockContract;

const ethersNamespace = {
  Wallet: Wallet as any,
  Contract: Contract as any,
  providers,
  getDefaultProvider: jest.fn(() => providerMock),
  utils,
  BigNumber,
  wordlists,
};

export const ethers = ethersNamespace;
export default ethersNamespace;
