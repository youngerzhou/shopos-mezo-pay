import { defineChain, createPublicClient, http } from 'viem';

const defaultSepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || 'https://rpc.test.mezo.org/';

/**
 * Get the first configured address from environment variables.
 * Prioritizes canonical NEXT_PUBLIC_MUSD_TOKEN_ADDRESS over legacy names.
 */
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
 * MUSD token contract address (canonical).
 * 
 * IMPORTANT: This must point to a valid ERC20 MUSD token contract on Mezo Testnet.
 * 
 * REQUIRED ERC20 FUNCTIONS:
 * - decimals()
 * - balanceOf(address)
 * - allowance(address owner, address spender)
 * - symbol()
 * - approve(address spender, uint256 amount)
 * 
 * VERIFICATION STEPS:
 * 1. Deploy or obtain the MUSD ERC20 token contract on Mezo Testnet
 * 2. Verify the address on Mezo Explorer: https://explorer.test.mezo.org/
 * 3. Test all ERC20 functions work correctly
 * 4. Set NEXT_PUBLIC_MUSD_TOKEN_ADDRESS in .env.local and Vercel environment variables
 * 
 * DO NOT USE:
 * - Merchant wallet address
 * - Pull payment contract address
 * - Payment processor contract address
 * - Any non-ERC20 contract
 */
export const MUSD_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_MUSD_TOKEN_ADDRESS?.trim() || '';

// Legacy fallback support (deprecated, migrate to NEXT_PUBLIC_MUSD_TOKEN_ADDRESS)
const LEGACY_MUSD_ADDRESS = firstConfiguredAddress([
  'NEXT_PUBLIC_SHOPOS_MUSD_TOKEN',
  'NEXT_PUBLIC_MUSD_ADDRESS',
]);

// Use canonical address, fallback to legacy for backward compatibility
export const MUSD_ADDRESSES = {
  testnet: MUSD_TOKEN_ADDRESS || LEGACY_MUSD_ADDRESS,
  mainnet: '0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186',
} as const;

export const SHOPOS_PULL_PAYMENT_CONTRACT =
  process.env.NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT?.trim() || '';
