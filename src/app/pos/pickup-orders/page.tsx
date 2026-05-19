"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, PackageCheck, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PickupOrder = {
  id: string;
  order_no: string;
  customer_referral_id: string | null;
  total_amount: number;
  currency: string;
  fulfillment_status: string;
  pickup_token: string;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  customer_name: string;
  items_summary: string;
};

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} MUSD`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function PickupOrdersPage() {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pos/orders/pickup', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load pickup orders');
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load pickup orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const groups = useMemo(() => ({
    awaitingPayment: orders.filter((order) => order.payment_status !== 'paid' && order.fulfillment_status !== 'completed'),
    readyForPickup: orders.filter((order) => order.payment_status === 'paid' && order.fulfillment_status === 'ready_for_pickup'),
    completed: orders.filter((order) => order.fulfillment_status === 'completed')
  }), [orders]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950">
      <section className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/pos/admin">
              <Button variant="outline" size="icon" className="rounded-md">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-700">ShopOS POS</p>
              <h1 className="text-2xl font-black tracking-tight">Customer Pickup Orders</h1>
            </div>
          </div>
          <Button variant="outline" className="rounded-md font-black" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
        ) : null}

        <div className="grid gap-4">
          <OrderGroup title="Awaiting Payment" tone="warn" orders={groups.awaitingPayment} empty="No orders waiting for payment." />
          <OrderGroup title="Ready for Pickup" tone="success" orders={groups.readyForPickup} empty="No paid orders waiting for pickup." />
          <OrderGroup title="Completed" tone="neutral" orders={groups.completed} empty="No completed pickup orders." />
        </div>
      </section>
    </main>
  );
}

function OrderGroup({ title, orders, empty, tone }: { title: string; orders: PickupOrder[]; empty: string; tone: 'warn' | 'success' | 'neutral' }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warn' ? TriangleAlert : PackageCheck;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black">
          <Icon className={`h-5 w-5 ${tone === 'success' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-500'}`} />
          {title}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{orders.length}</span>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-lg bg-slate-100 p-4 text-center text-sm font-bold text-slate-500">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <th className="border border-slate-200 px-2 py-2">Order</th>
                <th className="border border-slate-200 px-2 py-2">Customer / Member</th>
                <th className="border border-slate-200 px-2 py-2 text-right">Amount</th>
                <th className="border border-slate-200 px-2 py-2">Payment</th>
                <th className="border border-slate-200 px-2 py-2">Pickup</th>
                <th className="border border-slate-200 px-2 py-2">Created</th>
                <th className="border border-slate-200 px-2 py-2">Items</th>
                <th className="border border-slate-200 px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="border border-slate-200 px-2 py-2 font-black">{order.order_no}</td>
                  <td className="border border-slate-200 px-2 py-2 font-bold">{order.customer_name || order.customer_referral_id || '-'}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-black">{money(order.total_amount)}</td>
                  <td className="border border-slate-200 px-2 py-2 font-bold">{order.payment_status}</td>
                  <td className="border border-slate-200 px-2 py-2 font-bold">{order.fulfillment_status}</td>
                  <td className="border border-slate-200 px-2 py-2 font-bold">{formatDate(order.created_at)}</td>
                  <td className="max-w-[260px] truncate border border-slate-200 px-2 py-2 font-bold">{order.items_summary || '-'}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right">
                    {order.fulfillment_status === 'completed' ? (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">Completed</span>
                    ) : (
                      <Link href={`/pos/orders/claim/${encodeURIComponent(order.pickup_token)}`} className="inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-xs font-black text-white">
                        {order.payment_status === 'paid' ? 'Complete Pickup' : 'Take Payment'}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
