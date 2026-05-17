import { useState } from 'react';
import { BadgePercent, ChevronDown, ChevronUp, Minus, Plus, RefreshCw, ShoppingCart, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { roundMoney2 } from '@/app/lib/money';
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 text-white">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">Cart</p>
              <p className="text-xs font-bold text-slate-500">{totalQuantity} items / {discountLabel}</p>
            </div>
          </div>
          <div className="hidden items-center gap-5 text-right md:flex">
            <div>
              <p className="text-xs font-bold text-slate-500">Subtotal</p>
              <p className="font-black">{subtotal.toFixed(2)} MUSD</p>
            </div>
            <div>
              <p className="flex items-center justify-end gap-1 text-xs font-bold text-slate-500">
                <BadgePercent className="h-3.5 w-3.5 text-orange-700" />
                Discount
              </p>
              <p className="font-black text-orange-700">-{discount.toFixed(2)} MUSD</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500">Total</p>
            <p className="text-2xl font-black text-slate-950">{total.toFixed(2)}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-lg border-orange-200 hover:bg-red-950 hover:text-white"
            onClick={() => setIsExpanded((current) => !current)}
            title={isExpanded ? 'Collapse cart details' : 'Expand cart details'}
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-lg border-orange-200 px-3 font-black hover:bg-red-950 hover:text-white sm:px-4"
            disabled={cart.length === 0}
            onClick={onClearCart}
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <Button
            className="h-12 rounded-lg bg-orange-600 px-5 text-base font-black text-white hover:bg-red-950"
            disabled={loading || cart.length === 0}
            onClick={onCheckout}
          >
            {loading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Wallet className="mr-2 h-5 w-5" />}
            Checkout
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black md:hidden">
          <div className="text-slate-500">Subtotal</div>
          <div className="text-right">{subtotal.toFixed(2)} MUSD</div>
          <div className="text-slate-500">Discount</div>
          <div className="text-right text-orange-700">-{discount.toFixed(2)} MUSD</div>
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
                    <p className="text-xs font-bold text-slate-500">{lineTotal.toFixed(2)} MUSD</p>
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
