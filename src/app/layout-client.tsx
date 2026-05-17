'use client';

import dynamic from 'next/dynamic';

// Dynamically import Web3Provider with ssr: false to prevent SSR execution
const ClientRoot = dynamic(
    () => import('@/components/ClientRoot').then((mod) => mod.ClientRoot),
    { ssr: false }
);

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
    return <ClientRoot>{children}</ClientRoot>;
}
