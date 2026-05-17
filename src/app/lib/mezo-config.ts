import { defineChain, createPublicClient, http } from 'viem';

const defaultSepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || 'https://rpc.test.mezo.org/';

function firstConfiguredAddress(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

/** Centralized Sepolia / Mezo network and token configuration. */
export const mezoTestnet = defineChain({
  //id: 11155111,
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [defaultSepoliaRpc],
    },
    public: {
      http: [defaultSepoliaRpc],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mezo Explorer',
      url: 'https://explorer.test.mezo.org/',
    },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(defaultSepoliaRpc),
});

/**
 * MUSD token contract addresses by network.
 *
 * IMPORTANT: These addresses must point to valid ERC20 contracts that support:
 * - decimals()
 * - balanceOf(address)
 * - allowance(address, address)
 * - symbol()
 * - approve(address, uint256)
 *
 * Before deploying, verify each address on the corresponding blockchain explorer
 * and test that all ERC20 functions work correctly.
 *
 * Address precedence:
 * - NEXT_PUBLIC_MUSD_TOKEN_ADDRESS (canonical)
 * - NEXT_PUBLIC_SHOPOS_MUSD_TOKEN (legacy)
 * - NEXT_PUBLIC_MUSD_ADDRESS (legacy)
 */
export const MUSD_TOKEN_ADDRESS = firstConfiguredAddress([
  'NEXT_PUBLIC_MUSD_TOKEN_ADDRESS',
  'NEXT_PUBLIC_SHOPOS_MUSD_TOKEN',
  'NEXT_PUBLIC_MUSD_ADDRESS',
]);

export const MUSD_ADDRESSES = {
  testnet: MUSD_TOKEN_ADDRESS,
  mainnet: '0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186',
} as const;

export const SHOPOS_PULL_PAYMENT_CONTRACT =
  process.env.NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT?.trim() || '';
