/**
 * Web3 utilities built on viem for EVM chain interactions.
 * Supports Base L2 and DBC chain.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  type PublicClient,
  type Chain,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { base } from "viem/chains";

// DBC chain definition
export const dbcChain: Chain = {
  id: 19_880_818,
  name: "DBC Mainnet",
  nativeCurrency: { name: "DBC", symbol: "DBC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://info.dbcwallet.io"] },
  },
  blockExplorers: {
    default: { name: "DBC Explorer", url: "https://www.dbcscan.io" },
  },
};

export interface Web3Clients {
  base: PublicClient;
  dbc: PublicClient;
}

export function createClients(baseRpcUrl: string, dbcRpcUrl: string): Web3Clients {
  const baseClient = createPublicClient({
    chain: base,
    transport: http(baseRpcUrl),
  });

  const dbcClient = createPublicClient({
    chain: dbcChain,
    transport: http(dbcRpcUrl),
  });

  return {
    base: baseClient as PublicClient,
    dbc: dbcClient as PublicClient,
  };
}

// Standard ERC20 ABI for common operations
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Get native token balance (ETH on Base, DBC on DBC chain) */
export async function getNativeBalance(
  client: PublicClient,
  address: Address,
): Promise<string> {
  const balance = await client.getBalance({ address });
  return formatEther(balance);
}

/** Get ERC20 token balance */
export async function getErc20Balance(
  client: PublicClient,
  tokenAddress: Address,
  walletAddress: Address,
): Promise<{ balance: string; symbol: string; decimals: number }> {
  const [rawBalance, symbol, decimals] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
  ]);

  return {
    balance: formatUnits(rawBalance as bigint, decimals as number),
    symbol: symbol as string,
    decimals: decimals as number,
  };
}

/** Wait for transaction confirmation */
export async function waitForTx(
  client: PublicClient,
  hash: Hash,
): Promise<TransactionReceipt> {
  return client.waitForTransactionReceipt({ hash });
}

/** Get current gas price */
export async function getGasPrice(client: PublicClient): Promise<string> {
  const gasPrice = await client.getGasPrice();
  return formatUnits(gasPrice, 9); // Gwei
}

/** Known token addresses on Base */
export const BASE_TOKENS = {
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as Address,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  WETH: "0x4200000000000000000000000000000000000006" as Address,
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as Address,
};

// Re-export commonly used viem utilities
export {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  type Address,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
};
