'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { mezoTestnet } from '@/app/lib/mezo-chain';

export { mezoTestnet };

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

if (!walletConnectProjectId) {
  throw new Error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for WalletConnect mobile deep-linking.');
}

const config = createConfig(
  getDefaultConfig({
    walletConnectProjectId,
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
