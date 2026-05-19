"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, QrCode, RefreshCw, Search, TicketPercent, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    if (!issueCoupon || !selectedMemberId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(selectedMemberId)}/send-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: issueCoupon.id })
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
                Back to Admin Home
              </Button>
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-700">Admin Home</p>
              <h1 className="mt-1 text-2xl font-black">Coupons</h1>
              <p className="text-sm font-bold text-slate-500">Issue QR or send a coupon to one member.</p>
            </div>
          </div>
        </header>

        <div className="space-y-3">
          {COUPON_CAMPAIGNS.map((campaign) => {
            const campaignStats = stats[campaign.id] || { claimedCount: 0, usedCount: 0 };
            return (
              <article key={campaign.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                      <TicketPercent className="h-5 w-5" />
                    </div>
                    <h2 className="mt-3 text-lg font-black">{campaign.title}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">{campaign.description}</p>
                  </div>
                  <Badge>{campaign.id}</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <StatCard label="Discount" value={`${campaign.discountAmount.toFixed(2)} MUSD`} />
                  <StatCard label="Minimum" value={`${campaign.minimumSpend.toFixed(2)} MUSD`} />
                  <StatCard label="Claimed" value={String(campaignStats.claimedCount)} />
                  <StatCard label="Used" value={String(campaignStats.usedCount)} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button className="h-11 rounded-2xl font-black" onClick={() => openIssue(campaign)}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Issue QR
                  </Button>
                  <Button variant="outline" className="h-11 rounded-2xl font-black" onClick={() => setSendCoupon(campaign)}>
                    <Users className="mr-2 h-4 w-4" />
                    Send to Member
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        <Button variant="outline" className="h-12 w-full rounded-2xl font-black" onClick={fetchStats}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      <Dialog open={!!issueCoupon} onOpenChange={() => setIssueCoupon(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Issue QR</DialogTitle>
          </DialogHeader>
          {issueCoupon ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-lg font-black">{issueCoupon.title}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{issueCoupon.description}</p>
              </div>
            <div className="rounded-2xl border border-slate-200 p-4 text-center">
              <div className="mx-auto inline-flex rounded-2xl bg-white p-3 shadow-sm">
                <QRCodeCanvas value={qrUrl} size={180} level="H" />
              </div>
              <p className="mt-3 break-all text-xs font-mono font-bold text-slate-500">{qrUrl}</p>
            </div>
              <Button className="h-12 w-full rounded-2xl font-black" onClick={() => window.print()}>
                Print QR
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!sendCoupon} onOpenChange={() => setSendCoupon(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Send Coupon to Member</DialogTitle>
          </DialogHeader>
          {sendCoupon ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Coupon</p>
                <p className="mt-2 text-lg font-black">{sendCoupon.title}</p>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search member..." className="border-0 bg-transparent p-0 text-sm font-bold shadow-none focus-visible:ring-0" />
              </div>

              <div className="max-h-72 space-y-2 overflow-auto">
                {memberLoading && members.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-black text-slate-500">Loading members...</div>
                ) : members.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-black text-slate-500">No members found.</div>
                ) : members.map((member) => (
                  <label key={member.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${selectedMemberId === member.id ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`}>
                    <input type="radio" name="selectedMemberId" checked={selectedMemberId === member.id} onChange={() => setSelectedMemberId(member.id)} className="mt-1" />
                    <div className="min-w-0">
                      <p className="font-black">{member.name || 'Unnamed Member'}</p>
                      <p className="text-sm font-bold text-slate-500">{member.phone || member.email || '-'}</p>
                      <p className="text-xs font-black text-slate-500">{member.referral_id}</p>
                    </div>
                  </label>
                ))}
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" className="rounded-2xl font-black" onClick={() => setSendCoupon(null)} disabled={sending}>Cancel</Button>
                <Button className="rounded-2xl font-black" onClick={sendToMember} disabled={sending || !selectedMemberId}>
                  {sending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />}
                  Confirm Send
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
