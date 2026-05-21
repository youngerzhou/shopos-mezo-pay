import { useState } from 'react';
import { BadgePercent, ChevronDown, ChevronUp, Minus, Plus, RefreshCw, ShoppingCart, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { roundMoney2 } from '@/app/lib/money';
import { formatMoney } from '@/lib/money';
import type { CartItem } from './types';

interface CartBarProps {
  cart: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalQuantity: number;
  loading: boolean;
  discountLabel: string;
  onRemoveItem: (productId: string) => void;
  onIncreaseQty: (productId: string) => void;
  onDecreaseQty: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export function CartBar({
  cart,
  subtotal,
  discount,
  total,
  totalQuantity,
  loading,
  discountLabel,
  onRemoveItem,
  onIncreaseQty,
  onDecreaseQty,
  onClearCart,
  onCheckout
}: CartBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-200 bg-white shadow-2xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 md:px-5">
        <div className="flex items-center justify-between gap-1 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white sm:h-10 sm:w-10">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="hidden xs:block">
              <p className="text-[10px] font-black leading-none text-slate-950 sm:text-sm">Cart</p>
              <p className="text-[10px] font-bold text-slate-500 sm:text-xs">{totalQuantity} items / {discountLabel}</p>
            </div>
          </div>
          <div className="hidden items-center gap-5 text-right md:flex">
            <div>
              <p className="text-xs font-bold text-slate-500">Subtotal</p>
              <p className="font-black">{formatMoney(subtotal)}</p>
            </div>
            <div>
              <p className="flex items-center justify-end gap-1 text-xs font-bold text-slate-500">
                <BadgePercent className="h-3.5 w-3.5 text-orange-700" />
                Discount
              </p>
              <p className="font-black text-orange-700">-{formatMoney(discount)}</p>
            </div>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[10px] font-bold text-slate-500 sm:text-xs">Total</p>
            <p className="truncate text-lg font-black text-slate-950 sm:text-2xl">{formatMoney(total)}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-lg border-orange-200 hover:bg-red-950 hover:text-white sm:h-12 sm:w-12"
            onClick={() => setIsExpanded((current) => !current)}
            title={isExpanded ? 'Collapse cart details' : 'Expand cart details'}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-lg border-orange-200 px-2 font-black hover:bg-red-950 hover:text-white xs:px-3 sm:h-12 sm:px-4"
            disabled={cart.length === 0}
            onClick={onClearCart}
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <Button
            className="h-10 rounded-lg bg-orange-600 px-3 text-sm font-black text-white hover:bg-red-950 xs:px-5 xs:text-base sm:h-12"
            disabled={loading || cart.length === 0}
            onClick={onCheckout}
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin sm:h-5 sm:w-5" /> : <Wallet className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
            <span className="hidden xs:inline">Checkout</span>
            <span className="xs:hidden">Pay</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black md:hidden">
          <div className="text-slate-500">Subtotal</div>
          <div className="text-right">{formatMoney(subtotal)}</div>
          <div className="text-slate-500">Discount</div>
          <div className="text-right text-orange-700">-{formatMoney(discount)}</div>
        </div>

        {isExpanded && (
          <div className="flex gap-2 overflow-x-auto pb-1">
          {cart.length === 0 ? (
            <div className="w-full rounded-lg border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-center text-sm font-bold text-slate-500">
              Cart is empty
            </div>
          ) : (
            cart.map((item) => {
              const lineTotal = roundMoney2(Number(item.product.price) * item.qty);

              return (
                <div key={item.product.id} className="flex min-w-[240px] items-center gap-3 rounded-lg border border-orange-100 bg-orange-50 p-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-orange-100">
                    {item.product.image_url ? <img src={item.product.image_url} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{item.product.name}</p>
                    <p className="text-xs font-bold text-slate-500">{formatMoney(lineTotal)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-orange-200 hover:bg-red-950 hover:text-white" onClick={() => onDecreaseQty(item.product.id)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-black">{item.qty}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-orange-200 hover:bg-red-950 hover:text-white" onClick={() => onIncreaseQty(item.product.id)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:bg-red-950 hover:text-white" onClick={() => onRemoveItem(item.product.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}
      </div>
    </footer>
  );
}
