"use client";

import { roundMoney2 } from '@/app/lib/money';
import type { CartItem } from '../types';
import { discountLabel, formatMoney } from './format';

interface CheckoutItemListProps {
  cartItems: CartItem[];
  memberMultiplier: number;
  memberDiscountRate: number;
  finalBeforeExtraDiscount: number;
  totalQuantity: number;
}

export function CheckoutItemList({ cartItems, memberMultiplier, memberDiscountRate, finalBeforeExtraDiscount, totalQuantity }: CheckoutItemListProps) {
  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <div className="space-y-3 p-4">
        {cartItems.map((item) => {
          const unitPrice = roundMoney2(Number(item.product.price));
          const discounted = roundMoney2(unitPrice * item.qty * memberMultiplier);

          return (
            <div key={item.product.id} className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {item.product.image_url ? (
                  <img src={item.product.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-950">{item.product.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Qty x{item.qty}</p>
                  <span className="mt-1 inline-block rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-black text-orange-700">
                  {discountLabel(memberDiscountRate)}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-950">{formatMoney(discounted)}</p>
                <p className="mt-1 text-xs font-bold text-slate-400 line-through">{formatMoney(unitPrice * item.qty)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
        <span className="font-bold text-slate-500">{totalQuantity} items</span>
        <span className="font-black text-slate-950">Receivable {formatMoney(finalBeforeExtraDiscount)}</span>
      </div>
    </section>
  );
}
