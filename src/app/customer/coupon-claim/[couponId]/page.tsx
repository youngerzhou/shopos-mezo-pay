"use client";

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, TicketPercent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type ClaimableCoupon = {
  id: string;
  title: string;
  discount_amount: number;
  minimum_spend: number;
  expires_in_days: number;
};

type ClaimState = 'idle' | 'loading' | 'claimed' | 'already_claimed' | 'error';

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} MUSD`;
}

export default function CouponClaimPage() {
  const params = useParams<{ couponId: string }>();
  const searchParams = useSearchParams();
  const couponId = params.couponId;
  const initialReferralId = searchParams.get('referral_id') || searchParams.get('referralId') || '';
  const initialWallet = searchParams.get('wallet') || searchParams.get('wallet_address') || '';

  const [coupon, setCoupon] = useState<ClaimableCoupon | null>(null);
  const [referralId, setReferralId] = useState(initialReferralId);
  const [wallet, setWallet] = useState(initialWallet);
  const [loading, setLoading] = useState(true);
  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [message, setMessage] = useState('');

  const hasIdentity = useMemo(() => Boolean(referralId.trim() || wallet.trim()), [referralId, wallet]);
  const goShoppingHref = referralId.trim()
    ? `/customer/shop?referral_id=${encodeURIComponent(referralId.trim())}`
    : '/customer/shop';

  useEffect(() => {
    let cancelled = false;
    async function loadCoupon() {
      setLoading(true);
      setMessage('');
      try {
        const res = await fetch(`/api/customers/coupons/campaign/${encodeURIComponent(couponId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load coupon.');
        if (!cancelled) setCoupon(data.coupon);
      } catch (err: any) {
        if (!cancelled) {
          setClaimState('error');
          setMessage(err.message || 'Unable to load coupon.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCoupon();
    return () => {
      cancelled = true;
    };
  }, [couponId]);

  const claimCoupon = async () => {
    if (!hasIdentity) {
      setClaimState('error');
      setMessage('Enter your member ID to claim this coupon.');
      return;
    }

    setClaimState('loading');
    setMessage('');
    try {
      const res = await fetch(`/api/customers/coupons/campaign/${encodeURIComponent(couponId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_id: referralId.trim() || undefined,
          wallet: wallet.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setClaimState('already_claimed');
          setMessage(data.error || 'This coupon has already been claimed.');
          return;
        }
        throw new Error(data.error || 'Unable to claim coupon.');
      }
      setClaimState('claimed');
      setMessage('Coupon Claimed Successfully');
    } catch (err: any) {
      setClaimState('error');
      setMessage(err.message || 'Unable to claim coupon.');
    }
  };

  useEffect(() => {
    if (!loading && coupon && hasIdentity && claimState === 'idle') {
      claimCoupon();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, coupon, hasIdentity, claimState]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-slate-600">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm font-black">Loading coupon...</p>
          </div>
        ) : coupon ? (
          <div className="space-y-5">
            <header className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-700">
                {claimState === 'claimed' || claimState === 'already_claimed' ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : (
                  <TicketPercent className="h-8 w-8" />
                )}
              </div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">ShopOS Coupon</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">
                {claimState === 'claimed' ? 'Coupon Claimed Successfully' : coupon.title}
              </h1>
              {claimState === 'already_claimed' ? (
                <p className="mt-2 text-sm font-bold text-emerald-700">This coupon is already in your account.</p>
              ) : null}
            </header>

            <section className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-orange-950">{coupon.title}</p>
                  <p className="mt-1 text-sm font-bold text-orange-800">
                    Save {money(coupon.discount_amount)} on orders over {money(coupon.minimum_spend)}
                  </p>
                </div>
                <Badge className="bg-white text-orange-700">Unused</Badge>
              </div>
              <p className="mt-4 text-xs font-bold text-orange-800">Valid for {coupon.expires_in_days} days after claim.</p>
            </section>

            {!hasIdentity ? (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Member ID</label>
                <Input
                  value={referralId}
                  onChange={(event) => setReferralId(event.target.value)}
                  placeholder="Enter your member ID"
                  className="rounded-md bg-white font-bold"
                />
              </section>
            ) : null}

            {message ? (
              <p className={`text-center text-sm font-black ${
                claimState === 'error' ? 'text-red-600' : 'text-emerald-700'
              }`}>
                {message}
              </p>
            ) : null}

            {claimState === 'claimed' || claimState === 'already_claimed' ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-800">
                  Use on your next purchase.
                </p>
                <Link href={goShoppingHref}>
                  <Button className="h-12 w-full rounded-md font-black">Go Shopping</Button>
                </Link>
              </div>
            ) : (
              <Button className="h-12 w-full rounded-md font-black" onClick={claimCoupon} disabled={claimState === 'loading'}>
                {claimState === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />}
                Claim Coupon
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <TicketPercent className="mx-auto h-10 w-10 text-slate-400" />
            <h1 className="text-xl font-black">Coupon Unavailable</h1>
            <p className="text-sm font-bold text-slate-500">{message || 'This coupon could not be loaded.'}</p>
          </div>
        )}
      </section>
    </main>
  );
}
