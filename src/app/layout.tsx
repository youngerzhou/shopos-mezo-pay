
import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shopos Mezo | Clothing Store POS',
  description: 'A mobile-first Mezo chain POS system for modern retail.',
};

import { Web3Provider } from '@/components/Web3Provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
