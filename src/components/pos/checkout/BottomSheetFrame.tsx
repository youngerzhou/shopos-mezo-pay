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
        className="left-1/2 max-h-[92vh] w-full max-w-[430px] -translate-x-1/2 overflow-hidden rounded-t-[2.5rem] border-0 bg-white p-0 shadow-2xl transition-transform duration-300 ease-out [&>button]:hidden"
      >
        <div className="absolute inset-0 -z-10 bg-slate-50/50" /> {/* Inner subtle tint */}
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{title}</SheetDescription>
        <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-slate-200" />
        {children}
      </SheetContent>
    </Sheet>
  );
}

