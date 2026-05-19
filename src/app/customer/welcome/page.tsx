import Link from 'next/link';
import { Gift, Ticket, UserCheck } from 'lucide-react';
import { ensureDb, getSql } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export default async function CustomerWelcomePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tokenValue = params?.token;
  const token = Array.isArray(tokenValue) ? tokenValue[0] : tokenValue;
  let customer: any = null;

  if (token) {
    try {
      await ensureDb();
      const sql = getSql();
      const rows = await sql`
        SELECT referral_id, username
        FROM customers
        WHERE welcome_token = ${token}
        LIMIT 1
      `;
      customer = rows[0] || null;
    } catch (error) {
      console.error('[CustomerWelcome] Failed to load welcome token', error);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 text-white">
          <Gift className="h-8 w-8" />
        </div>
        <div className="mt-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-orange-700">ShopOS Welcome Gift</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Welcome to ShopOS</h1>
          <p className="mt-3 text-sm font-bold leading-relaxed text-slate-500">
            Your new member account has received a 5 MUSD coupon for orders over 100 MUSD.
          </p>
        </div>

        {customer ? (
          <div className="mt-6 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-emerald-700" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Member Recognized</p>
                <p className="text-sm font-black text-emerald-950">{customer.username || customer.referral_id}</p>
              </div>
            </div>
            <Link
              href={`/customer/membership-card?referral_id=${encodeURIComponent(customer.referral_id)}`}
              className="block rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-black text-white"
            >
              Open Membership Card
            </Link>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-bold text-amber-900">
            This welcome link is invalid or expired.
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
          <Ticket className="h-4 w-4 text-orange-700" />
          New Member Welcome Coupon
        </div>
      </section>
    </main>
  );
}
