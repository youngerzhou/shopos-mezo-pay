import { defineChain } from 'viem';

/** Mezo testnet — shared by client (wagmi) and server (viem public client). Do not import from `use client` modules here. */
export const mezoTestnet = defineChain({
  id: 2161,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'Mezo BTC', symbol: 'mBTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.test.mezo.org'] },
  },
  blockExplorers: {
    default: { name: 'MezoScan', url: 'https://explorer.test.mezo.org' },
  },
  testnet: true,
});
