"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, RefreshCw, Search, TicketPercent, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BottomSheetFrame } from '@/components/pos/checkout/BottomSheetFrame';
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

const DEFAULT_CAMPAIGNS = [
  { id: 'new-member-welcome', title: 'New Member Welcome Coupon', discountAmount: 5, minimumSpend: 100 },
  { id: 'next-purchase-reward', title: 'Next Purchase Coupon', discountAmount: 3, minimumSpend: 50 }
];

function shortValue(value?: string | null) {
  if (!value) return '-';
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export default function AdminMembersPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>(DEFAULT_CAMPAIGNS);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sendMember, setSendMember] = useState<Member | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState('new-member-welcome');
  const [sending, setSending] = useState(false);
  const [sentCoupons, setSentCoupons] = useState<Record<string, string[]>>({});

  const getUnusedCoupons = (m: Member | null): any[] => {
    if (!m) return [];
    const val = m.unused_coupons;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const currentCouponOwned = sendMember
    ? getUnusedCoupons(sendMember).some(c => c.title === (campaigns.find(cp => cp.id === selectedCouponId)?.title))
    : false;
  const currentCouponSent = sendMember
    ? sentCoupons[sendMember.id]?.includes(selectedCouponId)
    : false;
  const isDuplicate = !!(currentCouponOwned || currentCouponSent);

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
    const fetchCampaigns = async () => {
      try {
        const res = await fetch('/api/admin/coupons', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns);
        }
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      }
    };
    fetchCampaigns();
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
    if (isDuplicate) {
      toast({ variant: 'destructive', title: 'Send Failed', description: 'This member already holds this coupon, please do not send duplicate.' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(sendMember.id)}/send-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: selectedCouponId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to send coupon');

      // Update coupon sending history
      setSentCoupons(prev => ({
        ...prev,
        [sendMember.id]: [...(prev[sendMember.id] || []), selectedCouponId]
      }));

      const couponTitle = campaigns.find(c => c.id === selectedCouponId)?.title || data.coupon?.title || 'Coupon';
      const recipientName = sendMember.name || sendMember.phone || sendMember.wallet_address || sendMember.referral_id;

      toast({ 
        title: 'Success!', 
        description: `Successfully sent [${couponTitle}] to customer [${recipientName}].` 
      });
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
                Back
              </Button>
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-700">Admin Home</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Members</h1>
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

        <div className="space-y-3 pb-20">
          {loading && members.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-black text-slate-500">
               <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin opacity-20" />
               Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-black text-slate-500">
               <Users className="mx-auto mb-3 h-6 w-6 opacity-20" />
               No members found.
            </div>
          ) : members.map((member) => (
            <article key={member.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <button type="button" className="block w-full text-left" onClick={() => setSelectedMember(member)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-slate-950">{member.name || 'Unnamed Member'}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">{member.phone || member.email || '-'}</p>
                    <p className="mt-1 text-xs font-black text-slate-400">{member.referral_id}</p>
                  </div>
                  <Badge className="shrink-0 bg-orange-100 text-orange-700 hover:bg-orange-100 border-none rounded-full px-3 py-1 font-bold">{Number(member.unused_coupon_count || 0)} unused</Badge>
                </div>
              </button>
              <div className="mt-4 flex gap-2">
                <Button className="h-12 flex-1 rounded-2xl bg-orange-600 font-black text-white hover:bg-red-950" onClick={() => setSendMember(member)}>
                  <TicketPercent className="mr-2 h-4 w-4" />
                  Send Coupon
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Member Details Drawer */}
      <BottomSheetFrame open={!!selectedMember} title="Member Details" onOpenChange={(open) => !open && setSelectedMember(null)}>
        <div className="space-y-5 px-4 pb-10 pt-4">
          <h3 className="text-center text-base font-black text-slate-950">Member Details</h3>
          {selectedMember ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xl font-black text-slate-950">{selectedMember.name || 'Unnamed Member'}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-bold text-slate-500">{selectedMember.phone || selectedMember.email || '-'}</p>
                  <p className="text-xs font-black text-slate-400">ID: {selectedMember.referral_id}</p>
                  <p className="text-xs font-mono font-bold text-slate-400 truncate">{selectedMember.wallet_address || '-'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Available Coupons</p>
                {getUnusedCoupons(selectedMember).length > 0 ? (
                  <div className="space-y-2">
                    {getUnusedCoupons(selectedMember).map((coupon) => (
                      <div key={coupon.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <p className="font-black text-slate-950">{coupon.title}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Spend {Number(coupon.minimum_spend || 0).toFixed(2)}, save {Number(coupon.discount_amount || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
                    No available coupons.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button className="h-14 w-full rounded-2xl bg-orange-600 text-lg font-black text-white hover:bg-red-950" onClick={() => { setSendMember(selectedMember); setSelectedMember(null); }}>
                  Send New Coupon
                </Button>
                <Button variant="ghost" className="h-12 w-full rounded-2xl font-bold text-slate-500" onClick={() => setSelectedMember(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </BottomSheetFrame>

      {/* Send Coupon Drawer */}
      <BottomSheetFrame open={!!sendMember} title="Send Coupon" onOpenChange={(open) => !open && setSendMember(null)}>
        <div className="space-y-5 px-4 pb-10 pt-4">
          <h3 className="text-center text-base font-black text-slate-950">Send Coupon</h3>
          {sendMember ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-orange-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Recipient</p>
                <p className="mt-1 text-lg font-black text-slate-950">{sendMember.name || 'Member'} / {sendMember.referral_id}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Campaign</p>
                {campaigns.map((campaign) => {
                  const isSelected = selectedCouponId === campaign.id;
                  const isAlreadySent = sendMember ? sentCoupons[sendMember.id]?.includes(campaign.id) : false;
                  const isAlreadyOwned = sendMember ? getUnusedCoupons(sendMember).some(c => c.title === campaign.title) : false;
                  return (
                    <button 
                      key={campaign.id} 
                      type="button"
                      onClick={() => setSelectedCouponId(campaign.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                        isSelected ? 'border-orange-600 bg-orange-50' : 'border-slate-100 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-black ${isSelected ? 'text-orange-700' : 'text-slate-950'}`}>{campaign.title}</p>
                          {isAlreadySent && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0">Sent</Badge>
                          )}
                          {!isAlreadySent && isAlreadyOwned && (
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0">Owned</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {campaign.minimumSpend > 0 
                            ? `Spend ${campaign.minimumSpend.toFixed(2)}, save ${campaign.discountAmount.toFixed(2)}` 
                            : `Save ${campaign.discountAmount.toFixed(2)}`}
                        </p>
                      </div>
                      {isSelected && <Check className="h-5 w-5 shrink-0 text-orange-700" />}
                    </button>
                  );
                })}
              </div>

              {isDuplicate && (
                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
                  <p className="text-center text-xs font-bold text-amber-700 flex items-center justify-center gap-1">
                    ⚠️ This member already holds this coupon. Please do not duplicate send.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button 
                  className={`h-14 w-full rounded-2xl text-lg font-black text-white ${
                    isDuplicate 
                      ? 'bg-slate-200 text-slate-400 hover:bg-slate-200 cursor-not-allowed border border-slate-300 shadow-none' 
                      : 'bg-orange-600 hover:bg-red-950'
                  }`}
                  onClick={sendCoupon} 
                  disabled={sending || isDuplicate}
                >
                  {sending ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <TicketPercent className="mr-2 h-5 w-5" />}
                  {isDuplicate ? 'Already Owned/Sent' : 'Confirm Send'}
                </Button>
                <Button variant="ghost" className="h-12 w-full rounded-2xl font-bold text-slate-500" onClick={() => setSendMember(null)} disabled={sending}>
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
