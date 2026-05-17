"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { roundMoney2 } from '@/app/lib/money';
import { formatMUSD } from '@/lib/money';
import { POS_PAYMENT_METHODS } from './checkout-options';
import { BottomSheetFrame } from './BottomSheetFrame';
import { formatMoney } from './format';
import type { PaymentMethodId } from './types';

interface SplitPayment {
  method: PaymentMethodId;
  amount: string;
}

interface SplitPaymentSheetProps {
  open: boolean;
  amountDue: number;
  hasMember: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payments: { method: PaymentMethodId; amount: number }[]) => void;
}

function toAmountInput(value: number) {
  return roundMoney2(value).toFixed(2);
}

function methodLabel(methodId: PaymentMethodId) {
  return POS_PAYMENT_METHODS.find((method) => method.id === methodId)?.label || 'Cash';
}

export function SplitPaymentSheet({ open, amountDue, hasMember, onOpenChange, onConfirm }: SplitPaymentSheetProps) {
  const [payments, setPayments] = useState<SplitPayment[]>([{ method: 'cash', amount: '' }]);
  const [expandedIndex, setExpandedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setPayments([{ method: 'cash', amount: toAmountInput(amountDue) }]);
      setExpandedIndex(0);
    }
  }, [amountDue, open]);

  const parsedPayments = payments.map((payment) => ({
    method: payment.method,
    amount: roundMoney2(Number(payment.amount || 0))
  }));
  const paidTotal = roundMoney2(parsedPayments.reduce((sum, payment) => sum + payment.amount, 0));
  const remaining = roundMoney2(amountDue - paidTotal);
  const isOverpaid = paidTotal > amountDue;
  const hasCash = parsedPayments.some((payment) => payment.method === 'cash' && payment.amount > 0);
  const canConfirm = paidTotal > 0 && (paidTotal === amountDue || (isOverpaid && hasCash));
  const changeDue = isOverpaid && hasCash ? roundMoney2(paidTotal - amountDue) : 0;
  const fastPayAmount = parsedPayments.find((payment) => payment.method === 'musdFastPay')?.amount || 0;
  const usedMethods = useMemo(() => new Set(payments.map((payment) => payment.method)), [payments]);

  const updateAmount = (index: number, value: string) => {
    const cleaned = value.replace(/[^\d.]/g, '');
    const [whole, decimal = ''] = cleaned.split('.');
    const normalized = decimal ? `${whole}.${decimal.slice(0, 2)}` : whole;
    setPayments((current) => current.map((payment, paymentIndex) =>
      paymentIndex === index ? { ...payment, amount: normalized } : payment
    ));
  };

  const updateMethod = (index: number, method: PaymentMethodId) => {
    setPayments((current) => current.map((payment, paymentIndex) =>
      paymentIndex === index ? { ...payment, method } : payment
    ));
  };

  const addPayment = () => {
    if (remaining <= 0) return;
    const fallbackMethod = POS_PAYMENT_METHODS.find((method) => method.id !== 'cash' && !usedMethods.has(method.id))?.id || 'cash';
    setPayments((current) => [...current, { method: fallbackMethod, amount: toAmountInput(remaining) }]);
    setExpandedIndex(payments.length);
  };

  const removePayment = (index: number) => {
    setPayments((current) => current.filter((_, paymentIndex) => paymentIndex !== index));
    setExpandedIndex((current) => Math.max(0, Math.min(current, payments.length - 2)));
  };

  return (
    <BottomSheetFrame open={open} title="Split Payment" onOpenChange={onOpenChange}>
      <div className="px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">Split Payment</h3>
        <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-center">
          <p className="text-xs font-bold uppercase text-orange-700">Amount Due</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{formatMoney(amountDue)}</p>
        </div>

        <div className="mt-4 space-y-3">
          {payments.map((payment, index) => {
            const isExpanded = expandedIndex === index;
            const paidAmount = roundMoney2(Number(payment.amount || 0));

            if (!isExpanded && paidAmount > 0) {
              return (
                <button
                  key={index}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-100 p-4 text-left"
                  onClick={() => setExpandedIndex(index)}
                >
                  <span>
                    <span className="block text-sm font-black text-slate-950">Payment {index + 1}</span>
                    <span className="mt-1 block text-xs font-bold text-slate-500">{methodLabel(payment.method)}</span>
                    <span className="mt-1 block text-sm font-black text-slate-950">Paid {formatMoney(paidAmount)}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs font-black text-orange-700">
                    Edit
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>
              );
            }

            return (
              <div key={index} className="rounded-2xl bg-slate-100 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-black text-slate-950">Payment {index + 1}</p>
                  {payments.length > 1 ? (
                    <button type="button" className="rounded-full bg-white p-1 text-slate-500" onClick={() => removePayment(index)}>
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {POS_PAYMENT_METHODS.map((method) => {
                    const duplicateNonCash = method.id !== 'cash' && usedMethods.has(method.id) && payment.method !== method.id;
                    const disabled = (method.id === 'musdFastPay' && !hasMember) || duplicateNonCash;
                    const selected = payment.method === method.id;

                    return (
                      <button
                        key={method.id}
                        type="button"
                        disabled={disabled}
                        className={`relative rounded-xl px-2 py-2 text-left text-xs font-black ${
                          selected ? 'bg-orange-600 text-white' : disabled ? 'bg-white/50 text-slate-300' : 'bg-white text-slate-700'
                        }`}
                        onClick={() => updateMethod(index, method.id)}
                      >
                        {method.label}
                        {method.id === 'musdFastPay' && !hasMember ? <span className="block text-[10px]">Member required</span> : null}
                        {selected ? <Check className="absolute right-2 top-2 h-3.5 w-3.5" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center rounded-xl bg-white px-3 py-2">
                  <span className="mr-2 text-xl font-black text-slate-950">$</span>
                  <Input
                    value={payment.amount}
                    inputMode="decimal"
                    type="text"
                    placeholder="0.00"
                    onChange={(event) => updateAmount(index, event.target.value)}
                    className="h-10 border-0 bg-transparent p-0 text-xl font-black shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {payments.length < 2 && remaining > 0 ? (
          <button
            type="button"
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-black text-slate-600"
            onClick={addPayment}
          >
            <Plus className="h-4 w-4" />
            Add Payment Method
          </button>
        ) : null}

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold">
          <div className="flex justify-between">
            <span className="text-slate-500">Amount Due</span>
            <span className="text-slate-950">{formatMoney(amountDue)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-slate-500">Paid</span>
            <span className="text-slate-950">{formatMoney(paidTotal)}</span>
          </div>
          {remaining > 0 ? (
            <div className="mt-2 flex justify-between text-orange-700">
              <span>Remaining</span>
              <span>{formatMoney(remaining)}</span>
            </div>
          ) : null}
          {isOverpaid && !hasCash ? (
            <div className="mt-2 flex justify-between text-red-700">
              <span>Overpaid</span>
              <span>{formatMoney(roundMoney2(paidTotal - amountDue))}</span>
            </div>
          ) : null}
          {changeDue > 0 ? (
            <div className="mt-2 flex justify-between text-emerald-700">
              <span>Change Due</span>
              <span>{formatMoney(changeDue)}</span>
            </div>
          ) : null}
        </div>

        {fastPayAmount > 0 ? (
          <div className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-xs font-black uppercase text-orange-200">Blockchain Settlement</p>
            <p className="mt-1 text-xl font-black">{formatMUSD(fastPayAmount)}</p>
            <p className="mt-1 text-xs font-bold text-slate-300">Demo rate: 1 USD = 1 MUSD</p>
          </div>
        ) : null}

        <Button
          className="mt-5 h-12 w-full rounded-xl bg-orange-600 text-base font-black text-white hover:bg-red-950"
          disabled={!canConfirm}
          onClick={() => onConfirm(parsedPayments.filter((payment) => payment.amount > 0))}
        >
          Confirm Payment
        </Button>
      </div>
    </BottomSheetFrame>
  );
}
