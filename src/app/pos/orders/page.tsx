import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PosOrdersPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href="/pos/admin-home">
          <Button variant="outline" size="sm" className="mb-5 rounded-xl font-black">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Admin Home
          </Button>
        </Link>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-black">POS Orders</h1>
        <p className="mt-2 text-sm font-bold text-slate-500">Order management placeholder for the mobile admin demo.</p>
      </section>
    </main>
  );
}
