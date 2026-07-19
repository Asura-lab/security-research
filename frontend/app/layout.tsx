import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import './globals.css';

export const metadata = {
  title: 'PRISM Market — Modern Marketplace',
  description:
    'Discover 194 curated products across beauty, electronics, fashion, furniture and more. Free shipping over $50.',
};

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
