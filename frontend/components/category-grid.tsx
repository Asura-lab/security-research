import Link from 'next/link';
import {
  Sparkles,
  Laptop,
  Shirt,
  Watch,
  Sofa,
  ShoppingBag,
  Dumbbell,
  UtensilsCrossed,
  Car,
  FlowerIcon,
} from 'lucide-react';

const CATEGORIES = [
  { slug: 'beauty', name: 'Beauty', icon: Sparkles, color: 'bg-pink-50' },
  { slug: 'laptops', name: 'Laptops', icon: Laptop, color: 'bg-[color:var(--color-surface-3)]' },
  { slug: 'mens-shirts', name: 'Fashion', icon: Shirt, color: 'bg-amber-50' },
  { slug: 'mens-watches', name: 'Watches', icon: Watch, color: 'bg-stone-100' },
  { slug: 'furniture', name: 'Furniture', icon: Sofa, color: 'bg-[color:var(--color-surface-2)]' },
  { slug: 'groceries', name: 'Groceries', icon: ShoppingBag, color: 'bg-green-50' },
  { slug: 'sports-accessories', name: 'Sports', icon: Dumbbell, color: 'bg-orange-50' },
  { slug: 'kitchen-accessories', name: 'Kitchen', icon: UtensilsCrossed, color: 'bg-yellow-50' },
  { slug: 'vehicle', name: 'Automotive', icon: Car, color: 'bg-sky-50' },
  { slug: 'fragrances', name: 'Fragrances', icon: FlowerIcon, color: 'bg-purple-50' },
];

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-5 gap-3 sm:grid-cols-5 md:gap-4 lg:grid-cols-10">
      {CATEGORIES.map(({ slug, name, icon: Icon, color }) => (
        <Link
          key={slug}
          href={`/shop?category=${slug}`}
          className="group flex flex-col items-center gap-2.5 rounded-[14px] border border-[color:var(--color-border)] bg-white p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
        >
          <div
            className={`grid size-12 place-items-center rounded-full ${color} text-[color:var(--color-foreground)] transition-transform group-hover:scale-110`}
          >
            <Icon size={22} strokeWidth={1.5} />
          </div>
          <span className="text-xs font-medium leading-snug text-[color:var(--color-foreground)]">
            {name}
          </span>
        </Link>
      ))}
    </div>
  );
}
