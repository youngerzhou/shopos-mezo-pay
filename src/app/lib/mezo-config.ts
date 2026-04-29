import { defineChain } from 'viem';

/** Centralized Mezo network and token configuration. */
export const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: {
    name: 'Mezo',
    symbol: 'MEZO',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.test.mezo.org/'],
    },
    public: {
      http: ['https://rpc.test.mezo.org/'],
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

export const MUSD_ADDRESSES = {
  testnet: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503',
  mainnet: '0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186',
} as const;

export const SHOPOS_PULL_PAYMENT_CONTRACT = '0x489622dCC88cc10787A9A9A9A9A9A9A9A9A9A9A9' as const;
