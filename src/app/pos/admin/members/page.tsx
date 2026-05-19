"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Search, TicketPercent, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type Member = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  referral_id: string;
  wallet_address: string | null;
  unused_coupon_count: number;
  used_coupon_count?: number;
  unused_coupons?: Array<{
    id: string;
    title: string;
    discount_amount: number;
    minimum_spend: number;
    status: string;
    expires_at: string;
  }>;
};

const COUPON_CAMPAIGNS = [
  { id: 'new-member-welcome', title: 'New Member Welcome Coupon', discountAmount: 5, minimumSpend: 100 },
  { id: 'next-purchase-reward', title: 'Next Purchase Coupon', discountAmount: 3, minimumSpend: 50 }
];

function shortValue(value?: string | null) {
  if (!value) return '-';
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export default function AdminMembersPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sendMember, setSendMember] = useState<Member | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState('new-member-welcome');
  const [sending, setSending] = useState(false);

  const fetchMembers = async (term = query) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set('q', term.trim());
      const res = await fetch(`/api/admin/members${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load members');
      setMembers(Array.isArray(data.members) ? data.members : []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Members Error', description: err.message || 'Unable to load members.' });
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchMembers(query);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const sendCoupon = async () => {
    if (!sendMember) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(sendMember.id)}/send-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: selectedCouponId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to send coupon');
      toast({ title: 'Coupon sent successfully.', description: `${data.coupon?.title || 'Coupon'} sent to ${sendMember.name || sendMember.referral_id}.` });
      setSendMember(null);
      await fetchMembers(query);
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
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-700">Admin Home</p>
              <h1 className="mt-1 text-2xl font-black">Members</h1>
              <p className="text-sm font-bold text-slate-500">Search a member and send a coupon.</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search member..."
              className="h-10 border-0 bg-transparent p-0 text-sm font-bold shadow-none focus-visible:ring-0"
            />
          </div>
        </header>

        <div className="space-y-3">
          {loading && members.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center text-sm font-black text-slate-500">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-black text-slate-500">No members found.</div>
          ) : members.map((member) => (
            <article key={member.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <button type="button" className="block w-full text-left" onClick={() => setSelectedMember(member)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black">{member.name || 'Unnamed Member'}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">{member.phone || member.email || '-'}</p>
                    <p className="mt-1 text-xs font-black text-slate-500">{member.referral_id}</p>
                    <p className="mt-1 text-xs font-mono font-bold text-slate-400">{shortValue(member.wallet_address)}</p>
                  </div>
                  <Badge className="shrink-0">{Number(member.unused_coupon_count || 0)} unused</Badge>
                </div>
              </button>
              <div className="mt-4 flex gap-2">
                <Button className="h-11 flex-1 rounded-2xl font-black" onClick={() => setSendMember(member)}>
                  <TicketPercent className="mr-2 h-4 w-4" />
                  Send Coupon
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Member Details</DialogTitle>
          </DialogHeader>
          {selectedMember ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xl font-black">{selectedMember.name || 'Unnamed Member'}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{selectedMember.phone || selectedMember.email || '-'}</p>
                <p className="mt-1 text-xs font-black text-slate-500">{selectedMember.referral_id}</p>
                <p className="mt-1 text-xs font-mono font-bold text-slate-400">{selectedMember.wallet_address || '-'}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Available Coupons</p>
                {Array.isArray(selectedMember.unused_coupons) && selectedMember.unused_coupons.length > 0 ? (
                  selectedMember.unused_coupons.map((coupon) => (
                    <div key={coupon.id} className="rounded-2xl border border-slate-200 p-3">
                      <p className="font-black">{coupon.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        Spend {Number(coupon.minimum_spend || 0).toFixed(2)}, save {Number(coupon.discount_amount || 0).toFixed(2)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">No available coupons.</div>
                )}
              </div>

              <Button className="h-12 w-full rounded-2xl font-black" onClick={() => { setSendMember(selectedMember); setSelectedMember(null); }}>
                Send Coupon
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!sendMember} onOpenChange={() => setSendMember(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Send Coupon</DialogTitle>
          </DialogHeader>
          {sendMember ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Send coupon to</p>
                <p className="mt-2 text-lg font-black">{sendMember.name || 'Unnamed Member'} / {sendMember.referral_id}</p>
              </div>

              <div className="space-y-2">
                {COUPON_CAMPAIGNS.map((campaign) => (
                  <label key={campaign.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${selectedCouponId === campaign.id ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`}>
                    <input type="radio" name="couponId" value={campaign.id} checked={selectedCouponId === campaign.id} onChange={() => setSelectedCouponId(campaign.id)} className="mt-1" />
                    <div>
                      <p className="font-black">{campaign.title}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">Spend {campaign.minimumSpend.toFixed(2)}, save {campaign.discountAmount.toFixed(2)}</p>
                    </div>
                  </label>
                ))}
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" className="rounded-2xl font-black" onClick={() => setSendMember(null)} disabled={sending}>Cancel</Button>
                <Button className="rounded-2xl font-black" onClick={sendCoupon} disabled={sending}>
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
