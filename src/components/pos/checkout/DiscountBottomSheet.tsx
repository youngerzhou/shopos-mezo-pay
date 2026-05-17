"use client";

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DISCOUNT_OPTIONS } from './checkout-options';
import { BottomSheetFrame } from './BottomSheetFrame';
import type { DiscountOption } from './types';

interface DiscountBottomSheetProps {
  open: boolean;
  selectedId: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (option: DiscountOption) => void;
}

export function DiscountBottomSheet({ open, selectedId, onOpenChange, onSelect }: DiscountBottomSheetProps) {
  return (
    <BottomSheetFrame open={open} title="Order discount" onOpenChange={onOpenChange}>
      <div className="px-4 pb-4 pt-3">
        <h3 className="mb-4 text-center text-base font-black text-slate-950">Order Discount</h3>
        <div className="grid grid-cols-3 gap-3">
          {DISCOUNT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              className={`h-12 rounded-xl text-sm font-black ${
                selectedId === option.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button type="button" className="flex h-12 items-center justify-center gap-1 rounded-xl bg-slate-100 text-sm font-black text-slate-500">
            <Plus className="h-4 w-4" />
            Custom discount
          </button>
        </div>
      </div>
      <div className="sticky bottom-0 bg-white p-4">
        <Button className="h-12 w-full rounded-xl bg-orange-600 text-base font-black text-white hover:bg-red-950" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </div>
    </BottomSheetFrame>
  );
}
