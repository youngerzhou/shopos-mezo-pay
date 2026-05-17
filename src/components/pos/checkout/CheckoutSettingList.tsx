"use client";

import { ChevronRight } from 'lucide-react';

interface SettingItem {
  label: string;
  value: string;
  disabled?: boolean;
  onClick: () => void;
}

interface CheckoutSettingListProps {
  items: SettingItem[];
}

export function CheckoutSettingList({ items }: CheckoutSettingListProps) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          onClick={item.onClick}
          className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left ${
            index > 0 ? 'border-t border-slate-100' : ''
          } ${item.disabled ? 'text-slate-400' : 'text-slate-950'}`}
        >
          <span className="text-sm font-black">{item.label}</span>
          <span className="flex min-w-0 items-center gap-1 text-right text-sm font-bold text-slate-500">
            <span className="truncate">{item.value}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </span>
        </button>
      ))}
    </section>
  );
}

