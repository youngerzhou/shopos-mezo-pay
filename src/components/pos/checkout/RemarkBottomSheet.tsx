"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BottomSheetFrame } from './BottomSheetFrame';

interface RemarkBottomSheetProps {
  open: boolean;
  value: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: string) => void;
}

export function RemarkBottomSheet({ open, value, onOpenChange, onConfirm }: RemarkBottomSheetProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <BottomSheetFrame open={open} title="Remark" onOpenChange={onOpenChange}>
      <div className="px-4 pb-5 pt-3">
        <h3 className="text-center text-base font-black text-slate-950">Remark</h3>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add order notes"
          className="mt-4 min-h-28 rounded-2xl border-0 bg-slate-100 font-bold focus-visible:ring-orange-600"
        />
        <Button
          className="mt-5 h-12 w-full rounded-xl bg-orange-600 text-base font-black text-white hover:bg-red-950"
          onClick={() => {
            onConfirm(draft.trim());
            onOpenChange(false);
          }}
        >
          Confirm
        </Button>
      </div>
    </BottomSheetFrame>
  );
}

