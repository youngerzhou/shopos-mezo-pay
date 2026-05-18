"use client";

import { Suspense } from 'react';
import { CustomerPayContent } from '@/app/customer-pay/page';

export default function CustomerPaymentIntentPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-100 p-6 text-center font-bold">Loading payment...</main>}>
      <CustomerPayContent paymentIntentIdFromPath={params.id} />
    </Suspense>
  );
}
