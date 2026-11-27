import React from 'react';
import {
  BadgeCheck,
  BookOpen,
  Gamepad2,
  Laptop,
  LayoutGrid,
  Package,
  Puzzle,
  Receipt,
  ShoppingBag,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import type { CategoryIconName, CategoryId } from '../shared/types.ts';

const DEFAULT_ICON_BY_CAT: Record<string, CategoryIconName> = {
  books: 'book',
  shop: 'shopping',
  cosmetics: 'sparkles',
  toys: 'puzzle',
  accessories: 'smartphone',
  subs: 'badge',
  games: 'gamepad',
  bills: 'receipt',
};

export function CategoryIcon({
  cat,
  icon,
  className = 'h-4 w-4 shrink-0',
}: {
  cat: CategoryId | 'all';
  icon?: CategoryIconName;
  className?: string;
}) {
  if (cat === 'all') {
    return <LayoutGrid className={className} aria-hidden="true" />;
  }

  const resolved = icon || DEFAULT_ICON_BY_CAT[cat] || 'package';
  switch (resolved) {
    case 'book':
      return <BookOpen className={className} aria-hidden="true" />;
    case 'puzzle':
      return <Puzzle className={className} aria-hidden="true" />;
    case 'gamepad':
      return <Gamepad2 className={className} aria-hidden="true" />;
    case 'badge':
      return <BadgeCheck className={className} aria-hidden="true" />;
    case 'receipt':
      return <Receipt className={className} aria-hidden="true" />;
    case 'smartphone':
      return <Smartphone className={className} aria-hidden="true" />;
    case 'shopping':
      return <ShoppingBag className={className} aria-hidden="true" />;
    case 'laptop':
      return <Laptop className={className} aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'package':
    default:
      return <Package className={className} aria-hidden="true" />;
  }
}
