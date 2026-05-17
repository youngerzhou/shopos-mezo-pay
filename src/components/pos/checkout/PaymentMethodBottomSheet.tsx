"use client";

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POS_PAYMENT_METHODS } from './checkout-options';
import { BottomSheetFrame } from './BottomSheetFrame';
import { formatMoney } from './format';
import { formatMUSD } from '@/lib/money';
import type { CheckoutMember, PaymentMethodId } from './types';

interface PaymentMethodBottomSheetProps {
  open: boolean;
  amountDue: number;
  selectedMethod: PaymentMethodId;
  member: CheckoutMember | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (paymentMethod: PaymentMethodId) => void;
  onConfirmSingle: () => void;
  onOpenSplitPayment: () => void;
}

export function PaymentMethodBottomSheet({
  open,
  amountDue,
  selectedMethod,
  member,
  onOpenChange,
  onSelect,
  onConfirmSingle,
  onOpenSplitPayment
}: PaymentMethodBottomSheetProps) {
  const allowance = Number(member?.musdAllowance || 0);

  const getMethodState = (methodId: PaymentMethodId) => {
    if (methodId !== 'musdFastPay') return { disabled: false, detail: '' };
    if (!member) return { disabled: true, detail: 'Member required' };
    if (!member.walletAddress) return { disabled: true, detail: 'Wallet required' };
    if (allowance <= 0) return { disabled: true, detail: 'No allowance' };
    if (allowance < amountDue) return { disabled: true, detail: `Insufficient allowance: ${formatMUSD(allowance)}` };
    return { disabled: false, detail: `Allowance: ${formatMUSD(allowance)}` };
  };

  return (
    <BottomSheetFrame open={open} title="Payment method" onOpenChange={onOpenChange}>
      <div className="px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">Payment Method</h3>
        <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-center">
          <p className="text-xs font-bold uppercase text-orange-700">Amount Due</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{formatMoney(amountDue)}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {POS_PAYMENT_METHODS.map((method) => {
            const { disabled, detail } = getMethodState(method.id);
            const selected = selectedMethod === method.id;

            return (
              <button
                key={method.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(method.id)}
                className={`relative min-h-16 rounded-2xl px-3 py-3 text-left ${
                  selected ? 'bg-orange-600 text-white' : disabled ? 'bg-slate-50 text-slate-400' : 'bg-slate-100 text-slate-950'
                }`}
              >
                <span className="block text-sm font-black">{method.label}</span>
                {detail ? <span className="mt-1 block text-xs font-bold">{detail}</span> : null}
                {method.id === 'musdScanToPay' ? <span className="mt-1 block text-xs font-bold">Customer scans QR code</span> : null}
                {selected ? <span className="mt-1 block text-xs font-black">Amount: {formatMoney(amountDue)}</span> : null}
                {selected ? <Check className="absolute right-3 top-3 h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>

        {selectedMethod === 'musdFastPay' && member ? (
          <div className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-xs font-black uppercase text-orange-200">Blockchain Settlement</p>
            <p className="mt-1 text-xl font-black">{formatMUSD(amountDue)}</p>
            <p className="mt-1 text-xs font-bold text-slate-300">Pay with authorised MUSD. Demo rate: 1 USD = 1 MUSD</p>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 rounded-xl border-orange-200 font-black"
            onClick={onOpenSplitPayment}
          >
            Continue to Split Payment
          </Button>
          <Button
            className="h-12 rounded-xl bg-orange-600 font-black text-white hover:bg-red-950"
            disabled={getMethodState(selectedMethod).disabled}
            onClick={onConfirmSingle}
          >
            Confirm Payment
          </Button>
        </div>
      </div>
    </BottomSheetFrame>
  );
}
