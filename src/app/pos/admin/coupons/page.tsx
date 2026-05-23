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

type CouponCampaign = {
  id: string;
  title: string;
  description: string;
  couponType: 'threshold_discount' | 'cash_discount';
  discountAmount: number;
  minimumSpend: number;
  expiresInDays?: number;
};

export default function AdminCouponsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CouponCampaign[]>([]);
  const [stats, setStats] = useState<Record<string, { claimedCount: number; usedCount: number }>>({});
  const [issueCoupon, setIssueCoupon] = useState<any>(null);
  const [sendCoupon, setSendCoupon] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [sending, setSending] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  // New coupon form state
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRule, setNewRule] = useState<'threshold_discount' | 'cash_discount'>('threshold_discount');
  const [newDiscount, setNewDiscount] = useState('');
  const [newMinSpend, setNewMinSpend] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/coupons', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns);
        return data.campaigns;
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
    return [];
  };

  const fetchStats = async (campaignsList = campaigns) => {
    try {
      const entries = await Promise.all(campaignsList.map(async (campaign) => {
        const res = await fetch(`/api/customers/coupons/campaign/${encodeURIComponent(campaign.id)}`, { cache: 'no-store' });
        const data = await res.json();
        return [campaign.id, data.stats || { claimedCount: 0, usedCount: 0 }] as const;
      }));
      setStats(Object.fromEntries(entries));
    } catch (err: any) {
      console.error('Failed to load stats:', err);
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

  const loadData = async () => {
    setCampaignsLoading(true);
    const list = await fetchCampaigns();
    await fetchStats(list);
    await fetchMembers('');
    setCampaignsLoading(false);
  };

  useEffect(() => {
    loadData();
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

      toast({ title: 'Coupon Sent Successfully', description: `Successfully issued [${sendCoupon.title}] to member.` });
      setSendCoupon(null);
      await fetchStats();
      await fetchMembers(memberSearch);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Send Coupon Failed', description: err.message || 'Unable to send coupon.' });
    } finally {
      setSending(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a coupon title.' });
      return;
    }
    const discountVal = Number(newDiscount);
    if (isNaN(discountVal) || discountVal <= 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a valid discount amount.' });
      return;
    }
    const minSpendVal = newRule === 'threshold_discount' ? Number(newMinSpend) : 0;
    if (newRule === 'threshold_discount' && (isNaN(minSpendVal) || minSpendVal < 0)) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a valid minimum spend.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          couponType: newRule,
          discountAmount: discountVal,
          minimumSpend: minSpendVal
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create coupon campaign');

      toast({ title: 'Coupon Created', description: `Successfully created coupon campaign: "${newTitle}"` });
      setCreateOpen(false);
      setNewTitle('');
      setNewRule('threshold_discount');
      setNewDiscount('');
      setNewMinSpend('');
      
      if (Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns);
        await fetchStats(data.campaigns);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Create Coupon Failed', description: err.message || 'Unable to create coupon.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-6 text-slate-900 pb-safe">
      <div className="container mx-auto px-4 space-y-6">
        
        {/* Responsive Mobile-first Header with Add Coupon Button */}
        <header className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200/60 w-full max-w-md mx-auto sm:max-w-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/pos/admin-home">
              <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold bg-white text-slate-800 border-slate-200">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">POS Admin</p>
              <h1 className="text-xl font-black text-slate-950">Store Coupons</h1>
            </div>
          </div>
          <Button 
            className="h-11 rounded-xl bg-orange-600 font-black text-white hover:bg-slate-950 text-xs shadow-sm self-stretch sm:self-auto px-5 transition-all flex items-center justify-center gap-1.5 shrink-0" 
            onClick={() => setCreateOpen(true)}
          >
            <TicketPercent className="h-4 w-4" />
            Add Coupon
          </Button>
        </header>

        {/* Campaign List */}
        {campaignsLoading ? (
          <div className="rounded-3xl border border-slate-200/60 bg-white p-12 text-center text-sm font-bold text-slate-500 max-w-md mx-auto sm:max-w-none">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-orange-600 opacity-40" />
            Loading coupon campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/60 bg-white p-12 text-center text-sm font-bold text-slate-500 max-w-md mx-auto sm:max-w-none">
            No coupon campaigns registered.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-md mx-auto sm:max-w-none">
            {campaigns.map((campaign) => {
              const campaignStats = stats[campaign.id] || { claimedCount: 0, usedCount: 0 };
              const isBuiltIn = campaign.id === 'new-member-welcome' || campaign.id === 'next-purchase-reward';
              return (
                <article key={campaign.id} className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm flex flex-col justify-between h-full w-full">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                          <TicketPercent className="h-5 w-5" />
                        </div>
                        <h2 className="mt-4 text-lg font-black text-slate-950 leading-tight truncate" title={campaign.title}>{campaign.title}</h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">{campaign.description}</p>
                      </div>
                      <Badge className="bg-slate-100 text-slate-600 border-none font-bold uppercase tracking-wider text-[9px] px-2 shrink-0">
                        {isBuiltIn ? 'Built-in' : 'Custom'}
                      </Badge>
                    </div>

                    {/* Anti-clipping Responsive Stat Grid */}
                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                      <StatCard label="Discount" value={`${campaign.discountAmount.toFixed(2)} MUSD`} />
                      <StatCard label="Minimum Spend" value={`${campaign.minimumSpend.toFixed(2)} MUSD`} />
                      <StatCard label="Total Claimed" value={String(campaignStats.claimedCount)} />
                      <StatCard label="Total Used" value={String(campaignStats.usedCount)} />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-2">
                    <Button className="h-11 w-full rounded-xl bg-orange-600 font-black text-white hover:bg-slate-950 text-xs transition-colors shadow-sm" onClick={() => openIssue(campaign)}>
                      <QrCode className="mr-1.5 h-4 w-4" />
                      Issue QR
                    </Button>
                    <Button variant="outline" className="h-11 w-full rounded-xl border-slate-200 font-black text-slate-800 hover:bg-slate-50 text-xs transition-colors" onClick={() => setSendCoupon(campaign)}>
                      <Users className="mr-1.5 h-4 w-4 text-orange-600" />
                      Send to Member
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Refresh Button */}
        <div className="max-w-md mx-auto sm:max-w-none">
          <Button variant="outline" className="h-12 w-full rounded-2xl border-slate-200 bg-white font-black text-slate-950 hover:bg-slate-50 text-xs transition-colors" onClick={() => fetchStats(campaigns)}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh Stats
          </Button>
        </div>
      </div>

      {/* Add Coupon Bottom Sheet Drawer */}
      <BottomSheetFrame open={createOpen} title="Create Coupon" onOpenChange={(open) => !open && setCreateOpen(false)}>
        <form onSubmit={handleCreateCoupon} className="space-y-5 px-4 pb-10 pt-4">
          <h3 className="text-center text-base font-black text-slate-950">Add Coupon Campaign</h3>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Coupon Title</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Spend 200, save 15 Promo"
              className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold text-slate-950 focus-visible:ring-orange-500 focus-visible:ring-offset-0"
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Promotion Rule</label>
            <select
              value={newRule}
              onChange={(e) => setNewRule(e.target.value as any)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={submitting}
            >
              <option value="threshold_discount">Spend X, Save Y (Threshold Discount)</option>
              <option value="cash_discount">Direct Cash Discount (No Min Spend)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Discount Amount (MUSD)</label>
            <Input
              type="number"
              step="0.01"
              value={newDiscount}
              onChange={(e) => setNewDiscount(e.target.value)}
              placeholder="e.g. 5.00"
              className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold text-slate-950 focus-visible:ring-orange-500 focus-visible:ring-offset-0"
              required
              disabled={submitting}
            />
          </div>

          {newRule === 'threshold_discount' && (
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Minimum Spend (MUSD)</label>
              <Input
                type="number"
                step="0.01"
                value={newMinSpend}
                onChange={(e) => setNewMinSpend(e.target.value)}
                placeholder="e.g. 100.00"
                className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold text-slate-950 focus-visible:ring-orange-500 focus-visible:ring-offset-0"
                required
                disabled={submitting}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button 
              type="submit" 
              className="h-12 w-full rounded-xl bg-orange-600 text-sm font-black text-white hover:bg-slate-950 shadow-md transition-colors"
              disabled={submitting}
            >
              {submitting ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-1.5 h-4 w-4" />}
              Create Campaign
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="h-12 w-full rounded-xl font-bold text-slate-500" 
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </BottomSheetFrame>

      {/* QR drawer */}
      <BottomSheetFrame open={!!issueCoupon} title="Issue QR" onOpenChange={(open) => !open && setIssueCoupon(null)}>
        <div className="space-y-5 px-4 pb-10 pt-4">
          <h3 className="text-center text-base font-black text-slate-950">Issue QR</h3>
          {issueCoupon ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4 text-center border border-slate-100">
                <p className="text-base font-black text-slate-950 leading-tight">{issueCoupon.title}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{issueCoupon.description}</p>
              </div>
              <div className="rounded-[2rem] border-2 border-orange-50 bg-white p-5 text-center shadow-inner flex flex-col items-center">
                <div className="inline-flex rounded-xl bg-white p-2.5 shadow border border-slate-100 shrink-0">
                  <QRCodeCanvas value={qrUrl} size={150} level="H" />
                </div>
                <p className="mt-4 break-all text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest px-2 leading-relaxed">{qrUrl}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button className="h-12 w-full rounded-xl bg-orange-600 text-sm font-black text-white hover:bg-slate-950 shadow-md transition-colors" onClick={() => window.print()}>
                  Print QR Badge
                </Button>
                <Button variant="ghost" className="h-12 w-full rounded-xl font-bold text-slate-500" onClick={() => setIssueCoupon(null)}>
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
            <div className="space-y-5">
              <div className="rounded-2xl bg-orange-50 p-4 border border-orange-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Coupon selected</p>
                <p className="mt-1 text-base font-black text-slate-950 leading-tight truncate">{sendCoupon.title}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Find Member</label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-1">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search name or ID..." className="h-10 border-0 bg-transparent p-0 text-sm font-bold shadow-none focus-visible:ring-0 text-slate-950 focus:outline-none placeholder:text-slate-400" />
                </div>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {memberLoading && members.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin opacity-20 text-orange-600" />
                    Searching...
                  </div>
                ) : members.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                    No matching members.
                  </div>
                ) : members.map((member) => {
                  const isSelected = selectedMemberId === member.id;
                  return (
                    <button 
                      key={member.id} 
                      type="button"
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                        isSelected ? 'border-orange-600 bg-orange-50' : 'border-slate-100 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className={`font-black text-sm truncate ${isSelected ? 'text-orange-700' : 'text-slate-950'}`}>{member.name || 'Unnamed Member'}</p>
                        <p className="text-[11px] font-bold text-slate-500 truncate">{member.phone || member.email || '-'}</p>
                        <p className="text-[10px] font-black text-slate-400 truncate">ID: {member.referral_id}</p>
                      </div>
                      {isSelected && <Check className="h-5 w-5 shrink-0 text-orange-700 ml-2" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button className="h-12 w-full rounded-xl bg-orange-600 text-sm font-black text-white hover:bg-slate-950 shadow-md transition-colors" onClick={sendToMember} disabled={sending || !selectedMemberId}>
                  {sending ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-1.5 h-4 w-4" />}
                  Confirm & Send
                </Button>
                <Button variant="ghost" className="h-12 w-full rounded-xl font-bold text-slate-500" onClick={() => setSendCoupon(null)} disabled={sending}>
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
    <div className="rounded-2xl bg-slate-50 p-2.5 border border-slate-100 min-w-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{label}</p>
      <p className="mt-0.5 text-xs font-black text-slate-950 truncate" title={value}>{value}</p>
    </div>
  );
}
