"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CreditCard,
  Package,
  PackageCheck,
  ReceiptText,
  Settings,
  ShoppingBag,
  TicketPercent,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type AdminStats = {
  todaySales: number;
  todayOrders: number;
  newMembers: number;
};

const tiles = [
  { title: 'POS Orders', subtitle: 'View orders', href: '/pos/orders', icon: ShoppingBag },
  { title: 'Pickup Orders', subtitle: 'Waiting pickup', href: '/pos/pickup-orders', icon: PackageCheck },
  { title: 'Members', subtitle: 'Member list', href: '/pos/admin/members', icon: Users },
  { title: 'Coupons', subtitle: 'Issue coupons', href: '/pos/admin/coupons', icon: TicketPercent },
  { title: 'Daily Sales', subtitle: 'Reconciliation', href: '/pos/reconciliation', icon: BarChart3 },
  { title: 'Products', subtitle: 'Catalog', href: '/pos/products', icon: Package },
  { title: 'Payments', subtitle: 'Payment status', href: '/pos/payments', icon: CreditCard },
  { title: 'Settings', subtitle: 'Store settings', href: '/pos/settings', icon: Settings }
];

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} MUSD`;
}

export default function PosAdminHomePage() {
  const [stats, setStats] = useState<AdminStats>({ todaySales: 0, todayOrders: 0, newMembers: 0 });

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        const res = await fetch('/api/pos/reconciliation', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load stats');
        if (!cancelled) {
          setStats({
            todaySales: Number(data?.totals?.netPaidAmount || data?.totals?.grossSalesAmount || 0),
            todayOrders: Number(data?.totals?.totalOrders || 0),
            newMembers: Number(data?.membershipSummary?.newMembersRegisteredToday || 0)
          });
        }
      } catch {
        if (!cancelled) setStats({ todaySales: 0, todayOrders: 0, newMembers: 0 });
      }
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950">
      <section className="mx-auto max-w-md space-y-5">
        <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">Mobile Admin</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">ShopOS Admin</h1>
            </div>
            <Link href="/pos/scan">
              <Button variant="secondary" size="sm" className="rounded-xl font-black">
                <ArrowLeft className="mr-2 h-4 w-4" />
                POS
              </Button>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric label="Today Sales" value={money(stats.todaySales)} />
            <Metric label="Orders" value={String(stats.todayOrders)} />
            <Metric label="New Members" value={String(stats.newMembers)} />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link key={tile.href} href={tile.href} className="block">
                <div className="min-h-[118px] rounded-3xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.98] active:bg-orange-50">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-base font-black text-slate-950">{tile.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{tile.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <Link href="/pos/scan">
          <Button className="h-12 w-full rounded-2xl bg-slate-950 font-black text-white">
            Back to POS
          </Button>
        </Link>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}
