"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewMode = 'order' | 'pickup' | 'receipt';

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} MUSD`;
}

function shortValue(value?: string | null) {
  if (!value) return '-';
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

export function OrderStatusView({ mode = 'order' }: { mode?: ViewMode }) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const shouldPayOnline = searchParams.get('pay') === 'online';
  const [order, setOrder] = useState<any>(null);
  const [claimUrl, setClaimUrl] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const orderId = useMemo(() => params?.id || '', [params]);

  const loadOrder = async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/customer/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load order');
      setOrder(data.order);
      setClaimUrl(data.claimUrl || '');
      if (data.paymentUrl) setPaymentUrl(data.paymentUrl);
    } catch (err: any) {
      setError(err.message || 'Unable to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    const timer = window.setInterval(loadOrder, 8000);
    return () => window.clearInterval(timer);
  }, [orderId]);

  useEffect(() => {
    async function createPaymentLink() {
      if (!shouldPayOnline || !order || order.payment_status === 'paid' || paymentUrl) return;
      try {
        const res = await fetch('/api/pos/payment-intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            amountUsd: order.total_amount,
            amountMUSD: order.total_amount
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to create payment link');
        setPaymentUrl(data.qrPayload || `/customer/pay/${encodeURIComponent(data.paymentIntentId)}`);
      } catch (err: any) {
        setError(err.message || 'Unable to create payment link');
      }
    }
    createPaymentLink();
  }, [order, paymentUrl, shouldPayOnline]);

  const paid = order?.payment_status === 'paid';
  const completed = order?.fulfillment_status === 'completed';
  const readyForPickup = paid && order?.fulfillment_status === 'ready_for_pickup';
  const canShowQr = claimUrl && (paid || order?.payment_status === 'unpaid');
  const title = completed
    ? 'Order Completed'
    : paid
      ? mode === 'receipt' ? 'Payment Successful' : 'Order Ready for Pickup'
      : 'Pay at Counter';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950">
      <section className={`mx-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${mode === 'receipt' ? 'max-w-md font-mono' : 'max-w-lg'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">
              {mode === 'receipt' ? 'Payment Receipt' : 'Pickup Order'}
            </p>
            <h1 className="mt-1 text-2xl font-black">{order?.order_no || title}</h1>
          </div>
          <Button variant="outline" size="icon" className="rounded-md" onClick={loadOrder}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-lg bg-slate-100 p-5 text-center text-sm font-bold text-slate-500">Loading order...</div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
        ) : order ? (
          <div className="mt-5 space-y-5">
            {paid ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
                <p className="mt-2 text-xl font-black text-emerald-950">{completed ? 'Order Completed / Picked Up' : 'Payment Successful'}</p>
                <p className="mt-1 text-sm font-bold text-emerald-700">
                  {completed ? 'This pickup has already been completed.' : 'Show this QR code to the cashier.'}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <Clock className="mx-auto h-10 w-10 text-amber-700" />
                <p className="mt-2 text-xl font-black text-amber-950">Pay at Counter</p>
                <p className="mt-1 text-sm font-bold text-amber-700">Show this order QR code to the cashier and pay before pickup.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <StatusCard label="Payment" value={paid ? 'Paid' : 'Payment Required'} success={paid} />
              <StatusCard label="Pickup" value={completed ? 'Completed' : readyForPickup ? 'Ready' : 'Pending'} success={completed || readyForPickup} />
            </div>

            <div className="rounded-lg border border-slate-200">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between gap-3 border-b border-slate-200 px-3 py-2 text-sm last:border-b-0">
                  <span className="font-bold">{item.product_name} x {item.qty}</span>
                  <span className="font-black">{money(item.line_total)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <InfoLine label="Order number" value={order.order_no || '-'} />
              <InfoLine label="Customer / Member" value={order.membership?.username || order.customer_referral_id || '-'} />
              <InfoLine label="Payment method" value={order.payment_method || (paid ? 'MUSD Wallet Payment' : 'Counter Payment')} />
              <InfoLine label="Payment reference" value={shortValue(order.payment_tx_hash)} />
              <InfoLine label="Subtotal" value={money(order.subtotal)} />
              <InfoLine label="Discount" value={`-${money(Number(order.discount_amount || 0) + Number(order.coupon_discount_amount || 0))}`} />
              <InfoLine label="Paid amount" value={money(order.total_amount)} strong />
            </div>

            {!paid && shouldPayOnline && paymentUrl ? (
              <Link href={paymentUrl} className="block rounded-lg bg-orange-600 px-4 py-3 text-center text-sm font-black text-white">
                Pay Online Now
              </Link>
            ) : null}

            {mode === 'receipt' && orderId ? (
              <Link href={`/customer/order/${encodeURIComponent(orderId)}/pickup?status=${paid ? 'paid' : 'unpaid'}`} className="block rounded-lg bg-orange-600 px-4 py-3 text-center text-sm font-black text-white">
                View Pickup QR
              </Link>
            ) : null}

            {mode === 'pickup' && paid && orderId ? (
              <Link href={`/customer/order/${encodeURIComponent(orderId)}/receipt`} className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800">
                View Payment Receipt
              </Link>
            ) : null}

            {mode !== 'receipt' && canShowQr ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {paid ? 'Pickup QR Code' : 'Pay at Counter QR / Order QR'}
                </p>
                <div className="mt-4 inline-block rounded-xl bg-white p-4">
                  <QRCodeCanvas value={claimUrl} size={190} level="H" />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-600">
                  {paid ? 'Show this QR code to the cashier.' : 'Show this QR code to the cashier and pay at the counter.'}
                </p>
              </div>
            ) : null}

            {mode !== 'receipt' && !canShowQr ? (
              <div className="rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-800">
                Complete payment to unlock the pickup QR code.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function InfoLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="font-bold text-slate-500">{label}</span>
      <span className={`break-all text-right ${strong ? 'text-lg font-black text-slate-950' : 'font-black text-slate-800'}`}>{value}</span>
    </div>
  );
}

function StatusCard({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${success ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-black">
        {success ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Clock className="h-4 w-4 text-amber-700" />}
        {value}
      </p>
    </div>
  );
}
