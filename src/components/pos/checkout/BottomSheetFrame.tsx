"use client";

import type { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle
} from '@/components/ui/sheet';

interface BottomSheetFrameProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}

export function BottomSheetFrame({ open, title, children, onOpenChange }: BottomSheetFrameProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="left-1/2 max-h-[88vh] w-full max-w-[430px] -translate-x-1/2 overflow-hidden rounded-t-3xl border-0 bg-white p-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{title}</SheetDescription>
        <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-slate-300" />
        {children}
      </SheetContent>
    </Sheet>
  );
}

