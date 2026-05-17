"use client";

import { Check } from 'lucide-react';
import { COUPON_OPTIONS } from './checkout-options';
import { BottomSheetFrame } from './BottomSheetFrame';
import { formatMoney } from './format';
import type { CouponOption } from './types';

interface CouponBottomSheetProps {
  open: boolean;
  hasMember: boolean;
  baseAmount: number;
  selectedCouponId: string | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (coupon: CouponOption | null) => void;
}

export function CouponBottomSheet({ open, hasMember, baseAmount, selectedCouponId, onOpenChange, onSelect }: CouponBottomSheetProps) {
  return (
    <BottomSheetFrame open={open} title="Coupon" onOpenChange={onOpenChange}>
      <div className="space-y-3 px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">Coupon</h3>
        {!hasMember ? (
          <div className="rounded-xl bg-slate-100 px-4 py-5 text-center text-sm font-bold text-slate-500">
            Guest checkout has no coupons.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                onOpenChange(false);
              }}
              className="flex w-full items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700"
            >
              No coupon
              {!selectedCouponId ? <Check className="h-4 w-4 text-orange-700" /> : null}
            </button>
            {COUPON_OPTIONS.map((coupon) => {
              const available = baseAmount >= coupon.minSubtotal;
              const selected = selectedCouponId === coupon.id;

              return (
                <button
                  key={coupon.id}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    onSelect(coupon);
                    onOpenChange(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left ${
                    available ? 'bg-orange-50 text-slate-950' : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black">{coupon.label}</span>
                    <span className="mt-1 block text-xs font-bold opacity-70">Minimum spend {formatMoney(coupon.minSubtotal)}</span>
                  </span>
                  {selected ? <Check className="h-4 w-4 text-orange-700" /> : null}
                </button>
              );
            })}
          </>
        )}
      </div>
    </BottomSheetFrame>
  );
}
