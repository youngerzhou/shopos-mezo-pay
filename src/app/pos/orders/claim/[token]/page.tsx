"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, CreditCard, PackageCheck, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} MUSD`;
}

export default function PosClaimPickupPage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => params?.token || '', [params]);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pos/orders/claim?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load order');
      setOrder(data.order);
    } catch (err: any) {
      setError(err.message || 'Unable to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadOrder();
  }, [token]);

  const takePayment = async () => {
    if (!order?.id) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pos/orders/${encodeURIComponent(order.id)}/counter-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'counter' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to take payment');
      await loadOrder();
    } catch (err: any) {
      setError(err.message || 'Unable to take payment');
    } finally {
      setActionLoading(false);
    }
  };

  const completePickup = async () => {
    if (!order?.id) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pos/orders/${encodeURIComponent(order.id)}/complete-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_by: 'counter_staff' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to complete pickup');
      setOrder(data.order);
    } catch (err: any) {
      setError(err.message || 'Unable to complete pickup');
    } finally {
      setActionLoading(false);
    }
  };

  const paid = order?.payment_status === 'paid';
  const completed = order?.fulfillment_status === 'completed';

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">Pickup Claim</p>
            <h1 className="mt-1 text-2xl font-black">{order?.order_no || 'Customer Order'}</h1>
          </div>
          <Button variant="outline" size="icon" className="rounded-md" onClick={loadOrder} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-lg bg-slate-100 p-6 text-center text-sm font-bold text-slate-500">Loading order...</div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
        ) : order ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-2 sm:grid-cols-3">
              <Status label="Payment" value={paid ? 'Paid' : 'Payment Required'} tone={paid ? 'success' : 'warn'} />
              <Status label="Pickup" value={completed ? 'Completed' : paid ? 'Ready' : 'Pending'} tone={completed ? 'success' : paid ? 'success' : 'warn'} />
              <Status label="Source" value="Self-Service Order" tone="neutral" />
            </div>

            {completed ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
                Order already completed.
              </div>
            ) : !paid ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">
                Payment required before pickup.
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
                Payment confirmed. This order is ready for pickup.
              </div>
            )}

            <div className="rounded-lg border border-slate-200">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between gap-3 border-b border-slate-200 px-3 py-2 text-sm last:border-b-0">
                  <span className="font-bold">{item.product_name} x {item.qty}</span>
                  <span className="font-black">{money(item.line_total)}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <InfoRow label="Member" value={order.customer_referral_id || '-'} />
              <InfoRow label="Payment Reference" value={order.payment_tx_hash || '-'} />
              <InfoRow label="Payment Method" value={order.payment_method || '-'} />
              <InfoRow label="Total" value={money(order.total_amount)} />
            </div>

            {!completed ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {!paid ? (
                  <Button className="h-12 rounded-md bg-orange-600 font-black hover:bg-orange-700" onClick={takePayment} disabled={actionLoading}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Take Payment
                  </Button>
                ) : null}
                <Button className="h-12 rounded-md font-black" onClick={completePickup} disabled={actionLoading || !paid}>
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Complete Pickup
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Status({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warn' | 'neutral' }) {
  const classes = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={`rounded-lg border p-3 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-black">
        {tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : tone === 'warn' ? <TriangleAlert className="h-4 w-4" /> : null}
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-100 p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
