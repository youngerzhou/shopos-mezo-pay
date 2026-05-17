"use client";

import { create } from 'zustand';
import { roundMoney2 } from '@/app/lib/money';
import type { CartItem, Product } from '@/components/pos/types';

interface PosCartState {
  items: CartItem[];
  subtotal: number;
  totalQuantity: number;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  increaseQty: (productId: string) => void;
  decreaseQty: (productId: string) => void;
  clearCart: () => void;
}

function summarizeCart(items: CartItem[]) {
  return {
    subtotal: roundMoney2(items.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0)),
    totalQuantity: items.reduce((sum, item) => sum + item.qty, 0)
  };
}

function withSummary(items: CartItem[]) {
  return {
    items,
    ...summarizeCart(items)
  };
}

export const usePosCartStore = create<PosCartState>((set) => ({
  items: [],
  subtotal: 0,
  totalQuantity: 0,
  addItem: (product) => set((state) => {
    const existing = state.items.find((item) => item.product.id === product.id);
    const items = existing
      ? state.items.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: Math.min(item.qty + 1, Number(product.stock_qty)) }
            : item
        )
      : [...state.items, { product, qty: 1 }];

    return withSummary(items);
  }),
  removeItem: (productId) => set((state) =>
    withSummary(state.items.filter((item) => item.product.id !== productId))
  ),
  increaseQty: (productId) => set((state) =>
    withSummary(state.items.map((item) =>
      item.product.id === productId
        ? { ...item, qty: Math.min(item.qty + 1, Number(item.product.stock_qty)) }
        : item
    ))
  ),
  decreaseQty: (productId) => set((state) =>
    withSummary(state.items
      .map((item) => item.product.id === productId ? { ...item, qty: item.qty - 1 } : item)
      .filter((item) => item.qty > 0)
    )
  ),
  clearCart: () => set(withSummary([]))
}));
