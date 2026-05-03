import { defineChain } from 'viem';

const defaultSepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || 'https://rpc.test.mezo.org/';

/** Centralized Sepolia / Mezo network and token configuration. */
export const mezoTestnet = defineChain({
  //id: 11155111,
  id: 31611,
  name: 'Sepolia Testnet',
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
      name: 'Sepolia Etherscan',
      url: 'https://sepolia.etherscan.io/',
    },
  },
  testnet: true,
});

export const MUSD_ADDRESSES = {
  testnet: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503',
  mainnet: '0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186',
} as const;

export const SHOPOS_PULL_PAYMENT_CONTRACT = '0x489622dCC88cc10787A9A9A9A9A9A9A9A9A9A9A9' as const;
