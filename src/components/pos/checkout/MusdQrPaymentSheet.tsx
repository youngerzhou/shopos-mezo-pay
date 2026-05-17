"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMUSD } from '@/lib/money';
import { BottomSheetFrame } from './BottomSheetFrame';
import { formatMoney } from './format';
import type { CartItem } from '../types';
import type { CheckoutMember, SalespersonOption } from './types';

type IntentStatus = 'pending' | 'detected' | 'confirmed' | 'expired' | 'failed';

interface PaymentIntentResponse {
  paymentIntentId: string;
  orderId: string;
  amountUsd: number;
  amountMUSD: number;
  token: 'MUSD';
  network: 'mezo-testnet';
  merchantWallet: string;
  status: IntentStatus;
  qrPayload: string;
  expiresAt: string;
  payerWallet?: string;
  txHash?: string;
  blockNumber?: number;
}

interface MusdQrPaymentSheetProps {
  open: boolean;
  amountDue: number;
  cartItems: CartItem[];
  member: CheckoutMember | null;
  salesperson: SalespersonOption;
  onOpenChange: (open: boolean) => void;
  onConfirmed: (intent: PaymentIntentResponse) => void;
}

const STATUS_LABELS: Record<IntentStatus, string> = {
  pending: 'Waiting for customer payment...',
  detected: 'Payment detected, waiting for confirmation...',
  confirmed: 'Payment confirmed',
  expired: 'Payment expired',
  failed: 'Payment failed'
};

export function MusdQrPaymentSheet({
  open,
  amountDue,
  cartItems,
  member,
  salesperson,
  onOpenChange,
  onConfirmed
}: MusdQrPaymentSheetProps) {
  const [intent, setIntent] = useState<PaymentIntentResponse | null>(null);
  const [status, setStatus] = useState<IntentStatus>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSubmittedConfirmation, setHasSubmittedConfirmation] = useState(false);

  const qrPayload = intent?.qrPayload || '';
  const statusLabel = STATUS_LABELS[status] || 'Waiting for payment...';

  const createPaymentIntent = useCallback(async () => {
    setLoading(true);
    setError('');
    setIntent(null);
    setStatus('pending');
    setHasSubmittedConfirmation(false);

    try {
      const res = await fetch('/api/pos/payment-intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: amountDue,
          amountMUSD: amountDue,
          cartItems,
          member,
          salesperson
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create payment intent');

      setIntent(data);
      setStatus(data.status);
    } catch (err: any) {
      setError(err.message || 'Unable to create payment intent');
    } finally {
      setLoading(false);
    }
  }, [amountDue, cartItems, member, salesperson]);

  useEffect(() => {
    if (!open) return;
    createPaymentIntent();
  }, [createPaymentIntent, open]);

  useEffect(() => {
    if (!open || !intent?.paymentIntentId || status === 'confirmed' || status === 'expired' || status === 'failed') return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/pos/payment-intents/${encodeURIComponent(intent.paymentIntentId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to fetch payment status');

        setIntent((current) => ({ ...(current || intent), ...data }));
        setStatus(data.status);
      } catch (err: any) {
        setError(err.message || 'Unable to fetch payment status');
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [intent, open, status]);

  useEffect(() => {
    if (!intent || status !== 'confirmed' || hasSubmittedConfirmation) return;
    setHasSubmittedConfirmation(true);
    onConfirmed(intent);
  }, [hasSubmittedConfirmation, intent, onConfirmed, status]);

  const markDemoPaid = async () => {
    if (!intent) return;
    setLoading(true);
    setError('');

    try {
      const mockTxHash = `0x${Date.now().toString(16).padStart(64, '0')}`;
      const res = await fetch('/api/webhooks/goldsky/musd-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: intent.paymentIntentId,
          orderId: intent.orderId,
          txHash: mockTxHash,
          payerWallet: member?.walletAddress || '0x84edc7907f22e6108c3fed0f4be7633bd26aa134',
          merchant: intent.merchantWallet,
          token: 'MUSD',
          amountMUSD: intent.amountMUSD,
          blockNumber: Math.floor(Date.now() / 1000)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to confirm demo payment');

      const confirmedIntent = {
        ...intent,
        ...data.paymentIntent,
        paymentIntentId: data.paymentIntent.id || intent.paymentIntentId,
        qrPayload: intent.qrPayload
      };
      setIntent(confirmedIntent);
      setStatus('confirmed');
    } catch (err: any) {
      setError(err.message || 'Unable to confirm demo payment');
    } finally {
      setLoading(false);
    }
  };

  const qrBlocks = useMemo(() => Array.from({ length: 25 }), []);

  return (
    <BottomSheetFrame open={open} title="MUSD Scan to Pay" onOpenChange={onOpenChange}>
      <div className="px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">MUSD Scan to Pay</h3>
        <div className="mt-4 rounded-2xl bg-orange-50 p-4">
          <InfoRow label="Amount Due" value={formatMoney(amountDue)} />
          <InfoRow label="Pay" value={formatMUSD(amountDue)} />
          <InfoRow label="Network" value="Mezo Testnet" />
          <InfoRow label="Merchant" value="SHOPOS" />
          <InfoRow label="Payment Ref" value={intent?.paymentIntentId || 'Creating...'} />
          <InfoRow label="Status" value={loading && !intent ? 'Creating payment intent...' : statusLabel} />
        </div>

        <div className="mx-auto mt-5 flex h-56 w-56 items-center justify-center rounded-3xl border-8 border-white bg-white shadow-sm">
          <div className="grid h-44 w-44 grid-cols-5 grid-rows-5 gap-1 rounded-xl bg-slate-100 p-3">
            {qrBlocks.map((_, index) => (
              <div
                key={index}
                className={index % 2 === 0 || index % 7 === 0 ? 'rounded-sm bg-slate-950' : 'rounded-sm bg-white'}
              />
            ))}
          </div>
        </div>

        <p className="mt-4 break-all rounded-2xl bg-slate-100 p-3 text-center text-xs font-bold text-slate-500">
          {qrPayload || 'Generating QR payload...'}
        </p>

        {error ? (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-center text-xs font-bold text-red-700">{error}</p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 rounded-xl border-orange-200 font-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            className="h-12 rounded-xl font-black"
            disabled={!intent || loading || status === 'confirmed'}
            onClick={markDemoPaid}
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Demo: Mark as Paid
          </Button>
        </div>
      </div>
    </BottomSheetFrame>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm font-bold">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right text-slate-950">{value}</span>
    </div>
  );
}
