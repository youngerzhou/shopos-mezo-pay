"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, QrCode, RefreshCw, Search, TicketPercent, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomSheetFrame } from '@/components/pos/checkout/BottomSheetFrame';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { QRCodeCanvas } from 'qrcode.react';

type Member = {
  id: string;
  name: string | null;
  referral_id: string;
  phone: string | null;
  email: string | null;
};

const COUPON_CAMPAIGNS = [
  {
    id: 'new-member-welcome',
    title: 'New Member Welcome Coupon',
    description: 'Spend 100, save 5',
    discountAmount: 5,
    minimumSpend: 100
  },
  {
    id: 'next-purchase-reward',
    title: 'Next Purchase Coupon',
    description: 'Spend 50, save 3',
    discountAmount: 3,
    minimumSpend: 50
  }
];

export default function AdminCouponsPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Record<string, { claimedCount: number; usedCount: number }>>({});
  const [issueCoupon, setIssueCoupon] = useState<any>(null);
  const [sendCoupon, setSendCoupon] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [sending, setSending] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  const fetchStats = async () => {
    try {
      const entries = await Promise.all(COUPON_CAMPAIGNS.map(async (campaign) => {
        const res = await fetch(`/api/customers/coupons/campaign/${encodeURIComponent(campaign.id)}`, { cache: 'no-store' });
        const data = await res.json();
        return [campaign.id, data.stats || { claimedCount: 0, usedCount: 0 }] as const;
      }));
      setStats(Object.fromEntries(entries));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMembers = async (query = memberSearch) => {
    setMemberLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/admin/members${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load members');
      setMembers(Array.isArray(data.members) ? data.members : []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Members Error', description: err.message || 'Unable to load members.' });
      setMembers([]);
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchMembers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchMembers(memberSearch);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSearch]);

  const openIssue = (campaign: any) => {
    const origin = window.location.origin;
    setIssueCoupon(campaign);
    setQrUrl(`${origin}/customer/coupon-claim/${encodeURIComponent(campaign.id)}`);
  };

  const sendToMember = async () => {
    if (!sendCoupon || !selectedMemberId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(selectedMemberId)}/send-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: sendCoupon.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to send coupon');
      toast({ title: 'Coupon sent successfully.', description: `${data.coupon?.title || 'Coupon'} sent.` });
      setSendCoupon(null);
      await fetchStats();
      await fetchMembers(memberSearch);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Send Coupon Failed', description: err.message || 'Unable to send coupon.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950">
      <section className="mx-auto max-w-md space-y-4">
        <header className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Link href="/pos/admin-home">
              <Button variant="outline" size="sm" className="h-11 rounded-2xl font-black">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-700">Admin Home</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Coupons</h1>
            </div>
          </div>
        </header>

        <div className="space-y-3 pb-20">
          {COUPON_CAMPAIGNS.map((campaign) => {
            const campaignStats = stats[campaign.id] || { claimedCount: 0, usedCount: 0 };
            return (
              <article key={campaign.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                      <TicketPercent className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 text-xl font-black text-slate-950">{campaign.title}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">{campaign.description}</p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 border-none font-bold uppercase tracking-wider text-[10px]">{campaign.id}</Badge>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <StatCard label="Discount" value={`${campaign.discountAmount.toFixed(2)} MUSD`} />
                  <StatCard label="Minimum" value={`${campaign.minimumSpend.toFixed(2)} MUSD`} />
                  <StatCard label="Claimed" value={String(campaignStats.claimedCount)} />
                  <StatCard label="Used" value={String(campaignStats.usedCount)} />
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <Button className="h-12 w-full rounded-2xl bg-orange-600 font-black text-white hover:bg-red-950" onClick={() => openIssue(campaign)}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Issue QR
                  </Button>
                  <Button variant="outline" className="h-12 w-full rounded-2xl border-slate-200 font-black text-slate-950 hover:bg-slate-50" onClick={() => setSendCoupon(campaign)}>
                    <Users className="mr-2 h-4 w-4 text-orange-600" />
                    Send to Member
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        <Button variant="outline" className="h-14 w-full rounded-2xl border-slate-200 bg-white font-black text-slate-950 hover:bg-slate-50" onClick={fetchStats}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Stats
        </Button>
      </section>

      {/* Issue QR Drawer */}
      <BottomSheetFrame open={!!issueCoupon} title="Issue QR" onOpenChange={(open) => !open && setIssueCoupon(null)}>
        <div className="space-y-6 px-4 pb-10 pt-4">
          <h3 className="text-center text-base font-black text-slate-950">Issue QR</h3>
          {issueCoupon ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-slate-50 p-5 text-center">
                <p className="text-lg font-black text-slate-950">{issueCoupon.title}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{issueCoupon.description}</p>
              </div>
              <div className="rounded-[2.5rem] border-4 border-orange-50 bg-white p-8 text-center shadow-inner">
                <div className="mx-auto inline-flex rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
                  <QRCodeCanvas value={qrUrl} size={200} level="H" />
                </div>
                <p className="mt-5 break-all text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest px-4">{qrUrl}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button className="h-14 w-full rounded-2xl bg-orange-600 text-lg font-black text-white hover:bg-red-950" onClick={() => window.print()}>
                  Print QR Badge
                </Button>
                <Button variant="ghost" className="h-12 w-full rounded-2xl font-bold text-slate-500" onClick={() => setIssueCoupon(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </BottomSheetFrame>

      {/* Send Coupon to Member Drawer */}
      <BottomSheetFrame open={!!sendCoupon} title="Send Coupon to Member" onOpenChange={(open) => !open && setSendCoupon(null)}>
        <div className="space-y-5 px-4 pb-10 pt-4">
          <h3 className="text-center text-base font-black text-slate-950">Send to Member</h3>
          {sendCoupon ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-orange-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Coupon selected</p>
                <p className="mt-1 text-lg font-black text-slate-950">{sendCoupon.title}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Find Member</p>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-1">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search name or ID..." className="h-11 border-0 bg-transparent p-0 text-sm font-bold shadow-none focus-visible:ring-0" />
                </div>
              </div>

              <div className="max-h-60 space-y-2 overflow-auto pr-1">
                {memberLoading && members.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-black text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin opacity-20" />
                    Searching...
                  </div>
                ) : members.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                    No matching members.
                  </div>
                ) : members.map((member) => {
                  const isSelected = selectedMemberId === member.id;
                  return (
                    <button 
                      key={member.id} 
                      type="button"
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                        isSelected ? 'border-orange-600 bg-orange-50' : 'border-slate-100 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`font-black ${isSelected ? 'text-orange-700' : 'text-slate-950'}`}>{member.name || 'Unnamed Member'}</p>
                        <p className="text-xs font-bold text-slate-500">{member.phone || member.email || '-'}</p>
                        <p className="text-[10px] font-black text-slate-400">ID: {member.referral_id}</p>
                      </div>
                      {isSelected && <Check className="h-5 w-5 shrink-0 text-orange-700" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3">
                <Button className="h-14 w-full rounded-2xl bg-orange-600 text-lg font-black text-white hover:bg-red-950" onClick={sendToMember} disabled={sending || !selectedMemberId}>
                  {sending ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <TicketPercent className="mr-2 h-5 w-5" />}
                  Confirm & Send
                </Button>
                <Button variant="ghost" className="h-12 w-full rounded-2xl font-bold text-slate-500" onClick={() => setSendCoupon(null)} disabled={sending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </BottomSheetFrame>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
