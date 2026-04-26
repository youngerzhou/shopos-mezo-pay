'use client';

import React, { ReactNode } from 'react';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';

// Mezo Testnet Definition
export const mezoTestnet = defineChain({
  id: 21712,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'BTC', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.test.mezo.org'] },
  },
  blockExplorers: {
    default: { name: 'MezoScan', url: 'https://explorer.test.mezo.org' },
  },
  testnet: true,
});

const config = createConfig({
  chains: [mezoTestnet],
  transports: {
    [mezoTestnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
