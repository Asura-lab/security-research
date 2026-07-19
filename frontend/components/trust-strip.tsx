import { Truck, RotateCcw, ShieldCheck, Headphones } from 'lucide-react';

const ITEMS = [
  { icon: Truck, title: 'Free shipping', sub: 'Orders over $50' },
  { icon: RotateCcw, title: '30-day returns', sub: 'No questions asked' },
  { icon: ShieldCheck, title: 'Secure checkout', sub: 'Encrypted end-to-end' },
  { icon: Headphones, title: '24/7 support', sub: 'We are here for you' },
];

export function TrustStrip() {
  return (
    <div className="border-y border-[color:var(--color-border)] bg-white">
      <div className="mx-auto grid max-w-[var(--container-content)] grid-cols-2 divide-x divide-[color:var(--color-border)] px-4 md:grid-cols-4 md:px-6">
        {ITEMS.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex items-center gap-3 px-2 py-5 md:px-6 md:py-6">
            <div className="grid size-10 place-items-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-foreground)]">
              <Icon size={18} strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-sm font-medium">{title}</div>
              <div className="text-xs text-[color:var(--color-muted-foreground)]">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
