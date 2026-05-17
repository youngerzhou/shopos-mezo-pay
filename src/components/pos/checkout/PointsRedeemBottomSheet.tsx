"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { roundMoney2 } from '@/app/lib/money';
import { BottomSheetFrame } from './BottomSheetFrame';
import { formatMoney } from './format';

interface PointsRedeemBottomSheetProps {
  open: boolean;
  currentPoints: number;
  maxDeduction: number;
  value: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (amount: number) => void;
}

export function PointsRedeemBottomSheet({ open, currentPoints, maxDeduction, value, onOpenChange, onConfirm }: PointsRedeemBottomSheetProps) {
  const [input, setInput] = useState('');
  const pointsCashValue = roundMoney2(Math.floor(currentPoints / 100));
  const allowedMax = roundMoney2(Math.min(pointsCashValue, maxDeduction));
  const numericValue = roundMoney2(Math.min(Number(input || 0), allowedMax));
  const requiredPoints = Math.floor(numericValue * 100);

  useEffect(() => {
    if (open) setInput(value > 0 ? roundMoney2(value).toFixed(2) : '');
  }, [open, value]);

  const updateInput = (nextValue: string) => {
    const cleaned = nextValue.replace(/[^\d.]/g, '');
    const [whole, decimal = ''] = cleaned.split('.');
    const normalized = decimal ? `${whole}.${decimal.slice(0, 2)}` : whole;
    const capped = Math.min(Number(normalized || 0), allowedMax);
    setInput(normalized === '' ? '' : capped.toString());
  };

  return (
    <BottomSheetFrame open={open} title="Points deduction amount" onOpenChange={onOpenChange}>
      <div className="px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">Points Deduction Amount</h3>
        <p className="mt-1 text-center text-xs font-bold text-slate-500">Credit amount</p>
        <div className="mt-5 flex items-center rounded-2xl bg-slate-100 px-4 py-3">
          <span className="mr-2 text-3xl font-black text-slate-950">$</span>
          <Input
            value={input}
            inputMode="decimal"
            type="text"
            placeholder="0.00"
            onChange={(event) => updateInput(event.target.value)}
            className="h-14 border-0 bg-transparent p-0 text-4xl font-black shadow-none focus-visible:ring-0"
          />
          <button type="button" className="rounded-full bg-slate-200 p-1.5 text-slate-500" onClick={() => setInput('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-2 rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-700">
          <p>Remaining points {currentPoints}</p>
          <p>100 points = $1 credit</p>
          <p>Maximum deduction for this order is 20%: {formatMoney(maxDeduction)}</p>
          <p>This input uses {requiredPoints} points.</p>
        </div>
        <Button
          className="mt-5 h-12 w-full rounded-xl bg-orange-600 text-base font-black text-white hover:bg-red-950"
          disabled={allowedMax <= 0}
          onClick={() => {
            onConfirm(numericValue);
            onOpenChange(false);
          }}
        >
          Confirm
        </Button>
      </div>
    </BottomSheetFrame>
  );
}
