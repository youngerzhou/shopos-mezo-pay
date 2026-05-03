'use client';

import { WagmiProvider, createConfig, createStorage, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { mezoTestnet } from '@/app/lib/mezo-config';

export { mezoTestnet };

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim();

if (!walletConnectProjectId) {
  throw new Error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for WalletConnect mobile deep-linking.');
}

console.log('Check ID:', process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
console.log('Check RPC:', process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);

if (!sepoliaRpcUrl) {
  throw new Error('Missing NEXT_PUBLIC_SEPOLIA_RPC_URL for Sepolia / Mezo RPC transport.');
}

const baseStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.getItem !== 'function') {
      return null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.setItem !== 'function') {
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  },
  removeItem(key: string) {
    if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.removeItem !== 'function') {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  },
};

const storage = createStorage({
  storage: baseStorage,
  key: 'wagmi',
});

const config = createConfig(
  getDefaultConfig({
    walletConnectProjectId,
    appName: 'ShopOS Mezo',
    chains: [mezoTestnet],
    transports: {
      [mezoTestnet.id]: http(sepoliaRpcUrl),
    },
    storage,
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
