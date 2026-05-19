"use client";

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ReceiptText, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ReceiptItem = {
  id?: string;
  qty?: number;
  quantity?: number;
  product_name?: string;
  name?: string;
  unit_price?: number;
  line_total?: number;
  image_url?: string | null;
  imageUrl?: string | null;
  product_image?: string | null;
  productImage?: string | null;
  product?: {
    name?: string;
    price?: number;
    image_url?: string | null;
    imageUrl?: string | null;
    product_image?: string | null;
    productImage?: string | null;
  };
};

type PaymentIntentReceipt = {
  id: string;
  orderId: string;
  amountMUSD: number;
  status: string;
  payerWallet?: string;
  txHash?: string;
  confirmedAt?: string;
  rawEvent?: {
    cartItems?: ReceiptItem[];
    member?: {
      name?: string;
      username?: string;
      referralId?: string;
      referral_id?: string;
      phone?: string;
      email?: string;
    } | null;
    salesperson?: string | null;
  };
};

const FALLBACK_PRODUCT_IMAGE = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="12" fill="#f1f5f9"/>
  <path d="M25 34h46v34H25z" fill="#cbd5e1"/>
  <path d="M34 34c1.8-8 6.5-12 14-12s12.2 4 14 12" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
  <circle cx="37" cy="47" r="3" fill="#64748b"/>
  <circle cx="59" cy="47" r="3" fill="#64748b"/>
  <path d="M37 58c6 4 16 4 22 0" fill="none" stroke="#64748b" stroke-width="4" stroke-linecap="round"/>
</svg>
`)}`;

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} MUSD`;
}

function short(value?: string) {
  if (!value) return '-';
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function itemName(item: ReceiptItem) {
  return item.product?.name || item.product_name || item.name || 'Product';
}

function itemQty(item: ReceiptItem) {
  return Number(item.qty || item.quantity || 1);
}

function itemPrice(item: ReceiptItem) {
  return Number(item.product?.price || item.unit_price || 0);
}

function itemTotal(item: ReceiptItem) {
  return Number(item.line_total || itemPrice(item) * itemQty(item));
}

function itemImage(item: ReceiptItem) {
  return item.product?.image_url ||
    item.product?.imageUrl ||
    item.product?.product_image ||
    item.product?.productImage ||
    item.image_url ||
    item.imageUrl ||
    item.product_image ||
    item.productImage ||
    FALLBACK_PRODUCT_IMAGE;
}

export default function CustomerPaymentSuccessPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const paymentIntentId = params.id;
  const txHash = searchParams.get('txHash') || '';
  const [intent, setIntent] = useState<PaymentIntentReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadReceipt() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/pos/payment-intents/${encodeURIComponent(paymentIntentId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Unable to load receipt');
        if (!cancelled) setIntent(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Unable to load receipt');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [paymentIntentId]);

  const items = useMemo(() => {
    const rawItems = intent?.rawEvent?.cartItems;
    return Array.isArray(rawItems) ? rawItems : [];
  }, [intent]);
  const member = intent?.rawEvent?.member;
  const displayTxHash = txHash || intent?.txHash || '';

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-slate-600">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm font-black">Loading receipt...</p>
          </div>
        ) : error ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black">Receipt Unavailable</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">{error}</p>
            </div>
            <Link href="/customer/shop">
              <Button className="w-full rounded-md font-black">Back to Store</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <header className="border-b border-dashed border-slate-300 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">ShopOS Payment</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">Payment Successful</h1>
              <p className="mt-2 text-sm font-bold text-slate-500">MUSD Wallet Payment</p>
            </header>

            <section className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <Row label="Payment Ref" value={intent?.id || paymentIntentId} />
              <Row label="Order Number" value={intent?.orderId || searchParams.get('orderId') || '-'} />
              <Row label="Amount Paid" value={money(intent?.amountMUSD || 0)} strong />
              <Row label="Transaction" value={short(displayTxHash)} />
              {member ? (
                <Row
                  label="Member"
                  value={member.name || member.username || member.referralId || member.referral_id || member.phone || member.email || '-'}
                />
              ) : null}
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-600">
                <ReceiptText className="h-4 w-4" />
                Items
              </h2>
              {items.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-500">
                  Item details will appear on the POS receipt.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={item.id || `${itemName(item)}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                      <img
                        src={itemImage(item)}
                        alt={itemName(item)}
                        className="h-12 w-12 shrink-0 rounded-md bg-slate-100 object-cover"
                        onError={(event) => {
                          event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{itemName(item)}</p>
                        <p className="text-xs font-bold text-slate-500">Qty {itemQty(item)} x {money(itemPrice(item))}</p>
                      </div>
                      <p className="text-sm font-black">{money(itemTotal(item))}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Payment confirmed. Please show this receipt to the cashier if needed.
              </div>
            </section>

            <Link href="/customer/shop">
              <Button className="w-full rounded-md font-black">Back to Store</Button>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="font-bold text-slate-500">{label}</span>
      <span className={`max-w-[220px] break-words text-right ${strong ? 'text-base font-black text-slate-950' : 'font-black text-slate-800'}`}>{value}</span>
    </div>
  );
}
