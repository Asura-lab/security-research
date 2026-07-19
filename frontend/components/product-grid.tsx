import { ProductCard } from './product-card';
import type { DummyProduct } from '@/lib/dummyjson';
import { cn } from '@/lib/utils';

interface ProductGridProps {
  products: DummyProduct[];
  className?: string;
  columns?: 3 | 4 | 5;
}

export function ProductGrid({ products, className, columns = 4 }: ProductGridProps) {
  const cols = {
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  }[columns];
  return (
    <div className={cn('grid grid-cols-1 gap-4', cols, className)}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
