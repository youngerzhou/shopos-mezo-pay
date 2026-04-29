'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletConnectionStatus() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, isDisconnected, status } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayAddress = useMemo(() => {
    if (!address) return '';
    return shortenAddress(address);
  }, [address]);

  // Avoid SSR/client hydration mismatch from wallet state.
  if (!mounted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting wallet...
        </p>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Connected</Badge>
        <span className="font-mono text-sm text-emerald-800">{displayAddress}</span>
      </div>
    );
  }

  if (isDisconnected || status === 'disconnected') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <p className="text-sm font-medium text-amber-800">Please connect your wallet to continue</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">Please connect your wallet to continue</p>
    </div>
  );
}
