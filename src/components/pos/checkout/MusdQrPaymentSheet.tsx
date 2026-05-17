"use client";

import { Button } from '@/components/ui/button';
import { formatMUSD } from '@/lib/money';
import { BottomSheetFrame } from './BottomSheetFrame';
import { formatMoney } from './format';

interface MusdQrPaymentSheetProps {
  open: boolean;
  amountDue: number;
  onOpenChange: (open: boolean) => void;
  onMarkPaid: (qrPayload: string) => void;
}

export function MusdQrPaymentSheet({ open, amountDue, onOpenChange, onMarkPaid }: MusdQrPaymentSheetProps) {
  const qrPayload = `shopos://pay?token=MUSD&amount=${amountDue.toFixed(2)}&network=mezo-testnet`;

  return (
    <BottomSheetFrame open={open} title="MUSD Scan to Pay" onOpenChange={onOpenChange}>
      <div className="px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">MUSD Scan to Pay</h3>
        <div className="mt-4 rounded-2xl bg-orange-50 p-4">
          <div className="flex justify-between py-1 text-sm font-bold">
            <span className="text-slate-500">Amount Due</span>
            <span className="text-slate-950">{formatMoney(amountDue)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm font-bold">
            <span className="text-slate-500">Pay</span>
            <span className="text-slate-950">{formatMUSD(amountDue)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm font-bold">
            <span className="text-slate-500">Network</span>
            <span className="text-slate-950">Mezo Testnet</span>
          </div>
          <div className="flex justify-between py-1 text-sm font-bold">
            <span className="text-slate-500">Merchant</span>
            <span className="text-slate-950">SHOPOS</span>
          </div>
        </div>

        <div className="mx-auto mt-5 flex h-56 w-56 items-center justify-center rounded-3xl border-8 border-white bg-white shadow-sm">
          <div className="grid h-44 w-44 grid-cols-5 grid-rows-5 gap-1 rounded-xl bg-slate-100 p-3">
            {Array.from({ length: 25 }).map((_, index) => (
              <div
                key={index}
                className={index % 2 === 0 || index % 7 === 0 ? 'rounded-sm bg-slate-950' : 'rounded-sm bg-white'}
              />
            ))}
          </div>
        </div>

        <p className="mt-4 break-all rounded-2xl bg-slate-100 p-3 text-center text-xs font-bold text-slate-500">
          {qrPayload}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 rounded-xl border-orange-200 font-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-12 rounded-xl bg-orange-600 font-black text-white hover:bg-red-950"
            onClick={() => onMarkPaid(qrPayload)}
          >
            Mark as Paid
          </Button>
        </div>
      </div>
    </BottomSheetFrame>
  );
}

