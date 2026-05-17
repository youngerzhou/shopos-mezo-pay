"use client";

import { Check } from 'lucide-react';
import { SALESPERSON_OPTIONS } from './checkout-options';
import { BottomSheetFrame } from './BottomSheetFrame';
import type { SalespersonOption } from './types';

interface SalespersonBottomSheetProps {
  open: boolean;
  selectedStaffId: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (salesperson: SalespersonOption) => void;
}

export function SalespersonBottomSheet({ open, selectedStaffId, onOpenChange, onSelect }: SalespersonBottomSheetProps) {
  return (
    <BottomSheetFrame open={open} title="Salesperson" onOpenChange={onOpenChange}>
      <div className="space-y-2 px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">Salesperson</h3>
        {SALESPERSON_OPTIONS.map((person) => (
          <button
            key={person.staffId}
            type="button"
            onClick={() => {
              onSelect(person);
              onOpenChange(false);
            }}
            className="flex w-full items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-black text-slate-950">{person.name}</span>
              <span className="text-xs font-bold text-slate-500">{person.staffId}</span>
            </span>
            {selectedStaffId === person.staffId ? <Check className="h-4 w-4 text-orange-700" /> : null}
          </button>
        ))}
      </div>
    </BottomSheetFrame>
  );
}

