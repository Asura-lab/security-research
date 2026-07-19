import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function discountedPrice(price: number, discountPercentage: number) {
  return +(price - (price * discountPercentage) / 100).toFixed(2);
}

export function pct(value: number) {
  return `${Math.round(value)}%`;
}
