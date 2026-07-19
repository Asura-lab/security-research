import Link from 'next/link';
import { Globe, MessageCircle, PlayCircle, Code } from 'lucide-react';

const COLS = [
  {
    heading: 'Shop',
    links: [
      { href: '/shop', label: 'All products' },
      { href: '/categories', label: 'Categories' },
      { href: '/shop?sort=deal', label: 'Deals of the day' },
      { href: '/shop?sort=new', label: 'New arrivals' },
      { href: '/shop?sort=best', label: 'Best sellers' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '#', label: 'About Prism' },
      { href: '#', label: 'Careers' },
      { href: '#', label: 'Press' },
      { href: '#', label: 'Sustainability' },
      { href: '#', label: 'Contact' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { href: '#', label: 'Help center' },
      { href: '#', label: 'Track order' },
      { href: '#', label: 'Shipping' },
      { href: '#', label: 'Returns' },
      { href: '#', label: 'Warranty' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '#', label: 'Privacy' },
      { href: '#', label: 'Terms' },
      { href: '#', label: 'Cookies' },
      { href: '#', label: 'Accessibility' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="mx-auto max-w-[var(--container-content)] px-4 py-16 md:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--color-foreground)] text-white">
                <span className="text-sm font-semibold tracking-tight">P</span>
              </span>
              <span className="text-xl font-semibold tracking-tight">PRISM</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-[color:var(--color-muted-foreground)]">
              A modern marketplace for the everyday and the exceptional. Curated categories, honest
              reviews, straightforward pricing.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {[Globe, MessageCircle, PlayCircle, Code].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label={Icon.displayName ?? 'social'}
                  className="grid size-9 place-items-center rounded-full border border-[color:var(--color-border)] bg-white text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-foreground)]"
                >
                  <Icon size={16} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.heading}>
              <h3 className="section-label mb-4">{col.heading}</h3>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-[color:var(--color-foreground)] transition-colors hover:text-[color:var(--color-primary)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-8 text-xs text-[color:var(--color-muted-foreground)] md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} Prism Market. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Amex</span>
            <span>Apple Pay</span>
            <span>Google Pay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
