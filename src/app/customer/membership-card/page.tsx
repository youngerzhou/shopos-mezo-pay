"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

function MembershipCardContent() {
    const searchParams = useSearchParams();
    const referralId = searchParams?.get('referral_id') || searchParams?.get('referralId');
    const [member, setMember] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!referralId) {
            setError('Referral ID is required to display membership details.');
            setLoading(false);
            return;
        }

        const fetchMember = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/customers/verify?referral_id=${encodeURIComponent(referralId)}`);
                const data = await res.json();
                if (!res.ok || data.error) {
                    setError(data.error || 'Member not found.');
                } else {
                    setMember(data);
                }
            } catch (err) {
                setError('Unable to load membership details.');
            } finally {
                setLoading(false);
            }
        };

        fetchMember();
    }, [referralId]);

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
            <Toaster />
            <div className="w-full max-w-xl">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400 font-black">Customer Membership</p>
                        <h1 className="text-3xl font-black text-slate-900 mt-2">Membership Card</h1>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/'}
                    >
                        Back to Shop
                    </Button>
                </div>

                <div className="rounded-[3rem] bg-white shadow-2xl border border-slate-200 p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
                            <p className="text-sm font-black text-slate-500 uppercase">Loading membership details...</p>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center">
                            <Info className="mx-auto mb-4 w-10 h-10 text-amber-500" />
                            <p className="text-lg font-black text-slate-900">{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="rounded-[2.5rem] bg-slate-950 p-8 text-white text-center shadow-xl">
                                <div className="flex items-center justify-center mb-4">
                                    <ShieldCheck className="w-10 h-10 text-emerald-300" />
                                </div>
                                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Member Identifier</p>
                                <p className="mt-4 text-3xl font-black tracking-tight">{member.referral_id}</p>
                                <p className="mt-3 text-sm text-slate-400">{member.username || 'Unnamed Member'}</p>
                            </div>

                            <div className="grid gap-4">
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-xs uppercase tracking-[0.32em] text-slate-400 font-black">Contact</p>
                                        <Badge>{member.contact_info}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Identity Verified</p>
                                            <p className="mt-2 text-base font-black text-slate-900">{member.identity_verified ? 'Yes' : 'No'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Verified At</p>
                                            <p className="mt-2 text-base font-black text-slate-900">{member.verified_at || 'Not verified'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Fast Pay Authorization</p>
                                        <Badge>{member.fast_pay_enabled ? 'Enabled' : 'Disabled'}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Authorized Amount</p>
                                        <p className="mt-2 text-xl font-black text-slate-900">{member.fast_pay_allowance ? `${member.fast_pay_allowance} MUSD` : 'None'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MembershipCardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
                <div className="w-full max-w-xl">
                    <div className="rounded-[3rem] bg-white shadow-2xl border border-slate-200 p-8">
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
                            <p className="text-sm font-black text-slate-500 uppercase">Loading membership details...</p>
                        </div>
                    </div>
                </div>
            </div>
        }>
            <MembershipCardContent />
        </Suspense>
    );
}
