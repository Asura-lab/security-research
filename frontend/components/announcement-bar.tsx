import { Truck, ShieldCheck, RotateCcw } from 'lucide-react';

const MESSAGES = [
  { icon: Truck, text: 'Free shipping on orders over $50' },
  { icon: RotateCcw, text: '30-day easy returns' },
  { icon: ShieldCheck, text: 'Secure checkout, buyer protected' },
];

export function AnnouncementBar() {
  return (
    <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-foreground)] text-white">
      <div className="mx-auto flex h-9 max-w-[var(--container-content)] items-center justify-between px-4 text-xs md:px-6">
        <div className="hidden gap-6 md:flex">
          {MESSAGES.map(({ icon: Icon, text }) => (
            <div key={text} className="inline-flex items-center gap-2 text-white/80">
              <Icon size={14} strokeWidth={1.5} />
              <span>{text}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 md:hidden">
          <Truck size={14} strokeWidth={1.5} />
          <span className="text-white/80">Free shipping over $50</span>
        </div>
        <div className="flex items-center gap-4 text-white/80">
          <span className="hidden md:inline">Help</span>
          <span className="hidden md:inline">Track order</span>
          <span>USD</span>
        </div>
      </div>
    </div>
  );
}
