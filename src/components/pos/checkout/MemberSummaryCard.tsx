"use client";

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CheckoutMember } from './types';

interface MemberSummaryCardProps {
  member: CheckoutMember | null;
  expanded: boolean;
  points: number;
  couponCount: number;
  onToggle: () => void;
}

export function MemberSummaryCard({ member, expanded, points, couponCount, onToggle }: MemberSummaryCardProps) {
  const displayName = member?.username || 'Guest';
  const initial = displayName.slice(0, 1).toUpperCase();
  const memberDiscount = member && Number(member.discount_rate || 0) > 0
    ? `${Math.round(Number(member.discount_rate || 0) * 100)}% off`
    : 'Standard';

  return (
    <button type="button" onClick={onToggle} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-xl font-black text-orange-700">
          {member ? initial : 'G'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-black text-slate-950">{displayName}</p>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700">
              {member ? `${member.level_name} ${memberDiscount}` : 'Guest'}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-bold text-slate-500">
            {member ? `Member ID ${member.referral_id}` : 'No member selected'}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
      </div>
      {expanded ? (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          <Metric label="Balance" value="0.00" />
          <Metric label="Points" value={points.toString()} />
          <Metric label="Coupons" value={couponCount.toString()} />
        </div>
      ) : null}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 text-center">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
