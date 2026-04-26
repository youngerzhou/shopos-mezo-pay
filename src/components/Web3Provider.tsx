'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { defineChain } from 'viem';

// Mezo Testnet Definition
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

const config = createConfig(
  getDefaultConfig({
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "3fd2994967399f666fca3b37a1e2f8f6",
    appName: "ShopOS Mezo",
    chains: [mezoTestnet],
    transports: {
      [mezoTestnet.id]: http(),
    },
  })
);

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
