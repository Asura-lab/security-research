import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'security-research' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn">
      <body>
        <header>
          <a href="/">home</a>{' | '}
          <a href="/login">login</a>{' | '}
          <a href="/register">register</a>{' | '}
          <a href="/products">products</a>{' | '}
          <a href="/orders">orders</a>{' | '}
          <a href="/profile">profile</a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
