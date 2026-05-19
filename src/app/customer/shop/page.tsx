"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Minus, Plus, ShoppingBag, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { roundMoney2 } from '@/app/lib/money';

type Product = {
  id: string;
  barcode: string;
  name: string;
  category?: string;
  color?: string;
  size?: string;
  price: number;
  currency: string;
  stock_qty: number;
  image_url?: string;
};

type CartLine = {
  product: Product;
  qty: number;
};

type Coupon = {
  id: string;
  title: string;
  discount_amount: number;
  minimum_spend: number;
};

function money(value: number) {
  return `${roundMoney2(value).toFixed(2)} MUSD`;
}

export default function CustomerShopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralId = searchParams.get('referral_id') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(
    () => roundMoney2(cart.reduce((sum, line) => sum + Number(line.product.price) * line.qty, 0)),
    [cart]
  );
  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedCouponId && subtotal >= Number(coupon.minimum_spend || 0)) || null;
  const couponDiscount = selectedCoupon ? Math.min(Number(selectedCoupon.discount_amount || 0), subtotal) : 0;
  const total = roundMoney2(Math.max(subtotal - couponDiscount, 0));

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/products', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load products');
        setProducts(data.products || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load products');
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  useEffect(() => {
    if (!referralId || subtotal <= 0) {
      setCoupons([]);
      setSelectedCouponId('');
      return;
    }
    const controller = new AbortController();
    async function loadCoupons() {
      try {
        const params = new URLSearchParams({ referral_id: referralId, amount: String(subtotal) });
        const res = await fetch(`/api/customers/coupons?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load coupons');
        setCoupons(data.coupons || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') setCoupons([]);
      }
    }
    loadCoupons();
    return () => controller.abort();
  }, [referralId, subtotal]);

  const setQty = (product: Product, nextQty: number) => {
    const qty = Math.max(0, Math.min(product.stock_qty, nextQty));
    setCart((current) => {
      const without = current.filter((line) => line.product.id !== product.id);
      return qty > 0 ? [...without, { product, qty }] : without;
    });
  };

  const createOrder = async (mode: 'pay_online' | 'pay_at_counter') => {
    if (!referralId) {
      setError('Member ID is required before checkout.');
      return;
    }
    if (cart.length === 0) {
      setError('Add at least one product before checkout.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          customer_referral_id: referralId,
          coupon_id: selectedCoupon?.id || null,
          items: cart.map((line) => ({ barcode: line.product.barcode, qty: line.qty }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create order');
      if (mode === 'pay_online' && data.paymentUrl) {
        router.push(data.paymentUrl);
        return;
      }
      router.push(`/customer/order/${encodeURIComponent(data.order.order_id)}${mode === 'pay_online' ? '?pay=online' : ''}`);
    } catch (err: any) {
      setError(err.message || 'Unable to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">ShopOS Mezo</p>
            <h1 className="text-2xl font-black tracking-tight">Self-Service Pickup Order</h1>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-right text-xs font-black text-slate-600">
            Member<br /><span className="text-slate-950">{referralId || 'Missing'}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[1fr_360px]">
        <section>
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Loading products...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const line = cart.find((item) => item.product.id === product.id);
                return (
                  <article key={product.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-slate-100">
                        <ShoppingBag className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                    <div className="space-y-3 p-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{product.category || 'Product'}</p>
                        <h2 className="mt-1 text-base font-black">{product.name}</h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">{[product.color, product.size].filter(Boolean).join(' / ') || product.barcode}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-black text-orange-700">{money(Number(product.price))}</p>
                        {line ? (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-md" onClick={() => setQty(product, line.qty - 1)}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-6 text-center font-black">{line.qty}</span>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-md" onClick={() => setQty(product, line.qty + 1)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button className="rounded-md font-black" onClick={() => setQty(product, 1)} disabled={product.stock_qty <= 0}>
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <h2 className="text-lg font-black">Checkout</h2>
          <div className="mt-4 space-y-3">
            {cart.length === 0 ? (
              <div className="rounded-lg bg-slate-100 p-4 text-center text-sm font-bold text-slate-500">Your cart is empty.</div>
            ) : cart.map((line) => (
              <div key={line.product.id} className="flex justify-between gap-3 text-sm">
                <span className="font-bold">{line.product.name} x {line.qty}</span>
                <span className="font-black">{money(Number(line.product.price) * line.qty)}</span>
              </div>
            ))}
          </div>

          <div className="my-4 border-t border-slate-200" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="font-bold text-slate-500">Subtotal</span><span className="font-black">{money(subtotal)}</span></div>
            <div className="flex justify-between"><span className="font-bold text-slate-500">Coupon</span><span className="font-black">-{money(couponDiscount)}</span></div>
            <div className="flex justify-between text-lg"><span className="font-black">Total</span><span className="font-black">{money(total)}</span></div>
          </div>

          {coupons.length > 0 ? (
            <label className="mt-4 block text-xs font-black uppercase tracking-widest text-slate-500">
              Coupon
              <select
                value={selectedCouponId}
                onChange={(event) => setSelectedCouponId(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-bold normal-case tracking-normal"
              >
                <option value="">No coupon</option>
                {coupons.map((coupon) => (
                  <option key={coupon.id} value={coupon.id}>
                    {coupon.title} - {money(Number(coupon.discount_amount))}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 p-3 text-xs font-bold text-slate-500">
              <Ticket className="h-4 w-4" />
              No coupon available for this cart.
            </div>
          )}

          {error ? <p className="mt-4 text-sm font-bold text-red-600">{error}</p> : null}

          <div className="mt-4 grid gap-2">
            <Button className="h-12 rounded-md bg-orange-600 font-black hover:bg-orange-700" disabled={submitting || cart.length === 0} onClick={() => createOrder('pay_online')}>
              Pay Online & Pick Up
            </Button>
            <Button variant="outline" className="h-12 rounded-md font-black" disabled={submitting || cart.length === 0} onClick={() => createOrder('pay_at_counter')}>
              Pay at Counter
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}
