"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Settings, 
  Users, 
  Save, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowLeft, 
  QrCode,
  RefreshCw,
  Store, 
  ShieldCheck,
  Percent,
  TrendingUp,
  X,
  Printer,
  Wallet,
  PackageCheck,
  ReceiptText,
  TicketPercent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';

const COUPON_CAMPAIGNS = [
  {
    id: 'new-member-welcome',
    title: 'New Member Welcome Coupon',
    discountAmount: 5,
    minimumSpend: 100,
    description: 'Give new members 5 MUSD off orders over 100 MUSD.'
  },
  {
    id: 'next-purchase-reward',
    title: 'Next Purchase Coupon',
    discountAmount: 3,
    minimumSpend: 50,
    description: 'A simple return-visit coupon for customers after payment.'
  }
];

function shortValue(value?: string | null) {
  if (!value) return '-';
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export default function PosAdmin() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Control Center...</div>}>
      <PosAdminContent />
    </Suspense>
  );
}

function PosAdminContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'settings' | 'staff' | 'members' | 'coupons'>('settings');
  
  // Settings State
  const [settings, setSettings] = useState<any>({
    Global_Discount_Rate: '0.05',
    Referral_Commission_Rate: '0.05',
    Mezo_Passport_Bonus_Multiplier: '1.2'
  });
  
  // Staff State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({
    staff_id: '',
    username: '',
    role: 'staff',
    store_id: 'STORE_A'
  });

  // QR Badge State
  const [badgeStaff, setBadgeStaff] = useState<any>(null);
  const [couponStats, setCouponStats] = useState<Record<string, { claimedCount: number; usedCount: number }>>({});
  const [couponQr, setCouponQr] = useState<any>(null);
  const [couponQrUrl, setCouponQrUrl] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [sendCouponMember, setSendCouponMember] = useState<any>(null);
  const [selectedCouponId, setSelectedCouponId] = useState('new-member-welcome');
  const [sendCouponLoading, setSendCouponLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchStaff();
    fetchCouponStats();
    fetchMembers();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings' || tab === 'staff' || tab === 'members' || tab === 'coupons') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== 'members') return;
    const timer = window.setTimeout(() => {
      fetchMembers(memberSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeTab, memberSearch]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      setStaffList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMembers = async (query = memberSearch) => {
    setMembersLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/admin/members${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load members');
      setMembers(data.members || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Members Error", description: err.message || "Failed to load members." });
    } finally {
      setMembersLoading(false);
    }
  };

  const updateSettingValue = async (key: string, value: string) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        toast({ title: "Settings Updated", description: `${key} saved successfully.` });
        fetchSettings();
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update setting." });
    }
  };

  const handleStaffSubmit = async () => {
    try {
      const url = '/api/admin/staff';
      const method = editingStaff ? 'PUT' : 'POST';
      const body = editingStaff ? { ...staffForm, id: editingStaff.id } : staffForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast({ 
          title: editingStaff ? "Staff Updated" : "Staff Created", 
          description: `${staffForm.username} successfully ${editingStaff ? 'updated' : 'added'}.` 
        });
        setIsStaffModalOpen(false);
        setEditingStaff(null);
        setStaffForm({ staff_id: '', username: '', role: 'staff', store_id: 'STORE_A' });
        fetchStaff();
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Operation failed." });
    }
  };

  const deleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      const res = await fetch(`/api/admin/staff?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "Staff Removed", description: "Account deleted successfully." });
        fetchStaff();
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete staff." });
    }
  };

  const fetchCouponStats = async () => {
    try {
      const entries = await Promise.all(COUPON_CAMPAIGNS.map(async (campaign) => {
        const res = await fetch(`/api/customers/coupons/campaign/${encodeURIComponent(campaign.id)}`, { cache: 'no-store' });
        const data = await res.json();
        return [campaign.id, data.stats || { claimedCount: 0, usedCount: 0 }] as const;
      }));
      setCouponStats(Object.fromEntries(entries));
    } catch (err) {
      console.error('Failed to load coupon stats:', err);
    }
  };

  const showCouponQr = (campaign: any) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://shopos-mezo-pay.vercel.app';
    setCouponQr(campaign);
    setCouponQrUrl(`${origin}/customer/coupon-claim/${encodeURIComponent(campaign.id)}`);
  };

  const openSendCoupon = (member: any) => {
    setSendCouponMember(member);
    setSelectedCouponId('new-member-welcome');
  };

  const sendCouponToMember = async () => {
    if (!sendCouponMember) return;
    setSendCouponLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(sendCouponMember.id)}/send-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: selectedCouponId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to send coupon');
      toast({ title: "Coupon sent successfully.", description: `${data.coupon?.title || 'Coupon'} is now available to this member.` });
      setSendCouponMember(null);
      await fetchMembers();
      await fetchCouponStats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Send Coupon Failed", description: err.message || "Unable to send coupon." });
    } finally {
      setSendCouponLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link href="/pos/scan">
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">SHOPOS Mezo</p>
              <h1 className="text-2xl font-black tracking-tight text-primary">ADMIN CONSOLE</h1>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/pos/reconciliation">
              <Button variant="outline" className="rounded-md font-black">
                <ReceiptText className="mr-2 h-4 w-4" />
                Daily Reconciliation / Daily Sales
              </Button>
            </Link>
            <Link href="/pos/pickup-orders">
              <Button className="rounded-md font-black">
                <PackageCheck className="mr-2 h-4 w-4" />
                Pickup Orders
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 space-y-8">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'settings' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'staff' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Staff Roster
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'members'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Members
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'coupons'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <TicketPercent className="w-4 h-4 inline mr-2" />
            Coupons
          </button>
        </div>

        {activeTab === 'settings' ? (
           <div className="grid grid-cols-1 gap-6">
             {[
               { key: 'Global_Discount_Rate', label: 'Default Discount Rate', icon: <Percent className="w-5 h-5" />, desc: 'Base discount for all members (decimal format: 0.05 = 5%)' },
               { key: 'Referral_Commission_Rate', label: 'Staff Commission', icon: <TrendingUp className="w-5 h-5" />, desc: 'Revenue share per successful transaction (decimal)' },
               { key: 'Mezo_Passport_Bonus_Multiplier', label: 'Passport Multiplier', icon: <ShieldCheck className="w-5 h-5" />, desc: 'Extra bonus weight for high-level passport holders' },
               { key: 'Merchant_Wallet_Address', label: 'Merchant Recipient', icon: <Wallet className="w-5 h-5" />, desc: 'The on-chain destination for all customer payments' },
             ].map((s) => (
               <Card key={s.key} className="border-none shadow-sm overflow-hidden">
                 <CardHeader className="pb-3 border-b border-slate-50">
                   <div className="flex items-center gap-3 text-primary">
                     {s.icon}
                     <div>
                       <CardTitle className="text-base">{s.label}</CardTitle>
                       <CardDescription className="text-xs">{s.desc}</CardDescription>
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-4 flex gap-3">
                   <Input 
                     value={settings[s.key]} 
                     onChange={(e) => setSettings({...settings, [s.key]: e.target.value})}
                     className="font-mono text-lg font-bold"
                   />
                   <Button onClick={() => updateSettingValue(s.key, settings[s.key])}>
                     <Save className="w-4 h-4 mr-2" />
                     Save
                   </Button>
                 </CardContent>
               </Card>
             ))}
           </div>
        ) : activeTab === 'members' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <h1 className="text-4xl font-black tracking-tight text-primary">Members</h1>
                <p className="text-muted-foreground font-medium">Find a member and send a coupon for the next purchase.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search member..."
                  className="w-full rounded-xl bg-white font-bold md:w-80"
                />
                <Button variant="outline" className="rounded-xl font-black" onClick={() => fetchMembers()}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${membersLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                        <th className="border-b border-slate-200 px-4 py-3">Name</th>
                        <th className="border-b border-slate-200 px-4 py-3">Contact</th>
                        <th className="border-b border-slate-200 px-4 py-3">Referral ID</th>
                        <th className="border-b border-slate-200 px-4 py-3">Wallet</th>
                        <th className="border-b border-slate-200 px-4 py-3">Coupons</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membersLoading && members.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center font-black text-slate-500">Loading members...</td>
                        </tr>
                      ) : members.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center font-black text-slate-500">No members found.</td>
                        </tr>
                      ) : members.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-50">
                          <td className="border-b border-slate-100 px-4 py-3">
                            <button className="text-left font-black text-slate-950 hover:text-primary" onClick={() => setSelectedMember(member)}>
                              {member.name || 'Unnamed Member'}
                            </button>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-3 font-bold text-slate-600">
                            {member.phone || member.email || member.contact_info || '-'}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs font-black">{member.referral_id}</td>
                          <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs font-bold text-slate-500">
                            {shortValue(member.wallet_address)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-3">
                            <Badge>{Number(member.unused_coupon_count || 0)} unused</Badge>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-3 text-right">
                            <Button size="sm" className="rounded-xl font-black" onClick={() => openSendCoupon(member)}>
                              <TicketPercent className="mr-2 h-4 w-4" />
                              Send Coupon
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : activeTab === 'coupons' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tight text-primary">Coupon Distribution</h1>
              <p className="text-muted-foreground font-medium">Generate QR codes for customers to claim simple repeat-purchase coupons.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {COUPON_CAMPAIGNS.map((campaign) => {
                const stats = couponStats[campaign.id] || { claimedCount: 0, usedCount: 0 };
                return (
                  <Card key={campaign.id} className="border-none shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 text-primary">
                          <TicketPercent className="mt-1 h-5 w-5" />
                          <div>
                            <CardTitle className="text-base">{campaign.title}</CardTitle>
                            <CardDescription className="text-xs">{campaign.description}</CardDescription>
                          </div>
                        </div>
                        <Badge>{campaign.id}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discount</p>
                          <p className="mt-1 text-lg font-black">{campaign.discountAmount.toFixed(2)} MUSD</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Minimum Spend</p>
                          <p className="mt-1 text-lg font-black">{campaign.minimumSpend.toFixed(2)} MUSD</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Claimed</p>
                          <p className="mt-1 text-lg font-black text-emerald-950">{stats.claimedCount}</p>
                        </div>
                        <div className="rounded-xl bg-orange-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Used</p>
                          <p className="mt-1 text-lg font-black text-orange-950">{stats.usedCount}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button className="flex-1 rounded-xl font-black" onClick={() => showCouponQr(campaign)}>
                          <QrCode className="mr-2 h-4 w-4" />
                          Issue
                        </Button>
                        <Button variant="outline" className="rounded-xl font-black" onClick={fetchCouponStats}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <h1 className="text-4xl font-black tracking-tight text-primary">Staff Roster</h1>
                <p className="text-muted-foreground font-medium">Manage permissions and store assignments.</p>
              </div>
              <Button className="rounded-full px-6 gap-2" onClick={() => {
                setEditingStaff(null);
                setStaffForm({ staff_id: '', username: '', role: 'staff', store_id: 'STORE_A' });
                setIsStaffModalOpen(true);
              }}>
                <Plus className="w-4 h-4" />
                Add Member
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staffList.map((staff) => (
                <Card key={staff.id} className="group border-none shadow-sm hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{staff.username}</CardTitle>
                        <p className="text-xs font-mono text-muted-foreground">{staff.staff_id}</p>
                      </div>
                      <Badge variant={staff.role === 'admin' ? 'default' : 'secondary'} className="uppercase font-black text-[10px]">
                        {staff.role}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <Store className="w-3 h-3" />
                      {staff.store_id}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 rounded-xl h-9 text-xs font-bold"
                        onClick={() => {
                          setEditingStaff(staff);
                          setStaffForm({
                            staff_id: staff.staff_id,
                            username: staff.username,
                            role: staff.role,
                            store_id: staff.store_id
                          });
                          setIsStaffModalOpen(true);
                        }}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 rounded-xl h-9 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => deleteStaff(staff.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full rounded-xl h-9 text-xs font-bold text-primary hover:bg-primary/5"
                      onClick={() => setBadgeStaff(staff)}
                    >
                      <QrCode className="w-3 h-3 mr-1" />
                      Generate ID Badge
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Member Details Modal */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-lg rounded-[2rem] border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary">Member Details</DialogTitle>
          </DialogHeader>
          {selectedMember ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-slate-950">{selectedMember.name || 'Unnamed Member'}</p>
                    <p className="mt-1 font-mono text-xs font-black text-slate-500">{selectedMember.referral_id}</p>
                  </div>
                  <Badge>{Number(selectedMember.unused_coupon_count || 0)} unused</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm">
                  <InfoRow label="Contact" value={selectedMember.phone || selectedMember.email || selectedMember.contact_info || '-'} />
                  <InfoRow label="Wallet" value={selectedMember.wallet_address || '-'} />
                  <InfoRow label="Used Coupons" value={String(selectedMember.used_coupon_count || 0)} />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Available Coupons</p>
                {Array.isArray(selectedMember.unused_coupons) && selectedMember.unused_coupons.length > 0 ? (
                  <div className="space-y-2">
                    {selectedMember.unused_coupons.map((coupon: any) => (
                      <div key={coupon.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{coupon.title}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              Spend {Number(coupon.minimum_spend || 0).toFixed(2)}, save {Number(coupon.discount_amount || 0).toFixed(2)}
                            </p>
                          </div>
                          <Badge>{coupon.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">No available coupons.</div>
                )}
              </div>

              <Button className="h-12 w-full rounded-xl font-black" onClick={() => {
                openSendCoupon(selectedMember);
                setSelectedMember(null);
              }}>
                <TicketPercent className="mr-2 h-4 w-4" />
                Send Coupon
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Send Coupon Modal */}
      <Dialog open={!!sendCouponMember} onOpenChange={() => setSendCouponMember(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary">Send Coupon</DialogTitle>
          </DialogHeader>
          {sendCouponMember ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Send coupon to</p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  {sendCouponMember.name || 'Unnamed Member'} / {sendCouponMember.referral_id}
                </p>
              </div>

              <div className="space-y-3">
                {COUPON_CAMPAIGNS.map((campaign) => (
                  <label key={campaign.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                    selectedCouponId === campaign.id ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="couponId"
                      value={campaign.id}
                      checked={selectedCouponId === campaign.id}
                      onChange={() => setSelectedCouponId(campaign.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="font-black text-slate-950">{campaign.title}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        Spend {campaign.minimumSpend.toFixed(2)}, save {campaign.discountAmount.toFixed(2)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" className="rounded-xl font-black" onClick={() => setSendCouponMember(null)} disabled={sendCouponLoading}>
                  Cancel
                </Button>
                <Button className="rounded-xl font-black" onClick={sendCouponToMember} disabled={sendCouponLoading}>
                  {sendCouponLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />}
                  Confirm Send
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Staff Modal */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="max-w-md rounded-[3rem] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary">
              {editingStaff ? 'Edit Staff Member' : 'Add New Staff'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Username</label>
              <Input 
                value={staffForm.username} 
                onChange={(e) => setStaffForm({...staffForm, username: e.target.value})} 
                placeholder="Enter full name"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Staff ID</label>
              <Input 
                value={staffForm.staff_id} 
                onChange={(e) => setStaffForm({...staffForm, staff_id: e.target.value})} 
                placeholder="e.g. SHOP_01"
                disabled={!!editingStaff}
                className="rounded-xl font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Role</label>
                <Select value={staffForm.role} onValueChange={(val) => setStaffForm({...staffForm, role: val})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Store</label>
                <Select value={staffForm.store_id} onValueChange={(val) => setStaffForm({...staffForm, store_id: val})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STORE_A">Store A</SelectItem>
                    <SelectItem value="STORE_B">Store B</SelectItem>
                    <SelectItem value="HQ">HQ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 mt-4 sm:flex-col">
            <Button className="w-full rounded-2xl h-12 font-bold" onClick={handleStaffSubmit}>
              {editingStaff ? 'Save Changes' : 'Create Account'}
            </Button>
            <Button variant="ghost" className="w-full rounded-2xl h-12 font-bold" onClick={() => setIsStaffModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Badge Modal */}
      <Dialog open={!!badgeStaff} onOpenChange={() => setBadgeStaff(null)}>
        <DialogContent className="max-w-sm rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl">
           <div className="bg-primary p-12 text-center text-white space-y-8 flex flex-col items-center">
              <div className="space-y-2">
                <Badge className="bg-secondary text-primary font-black animate-pulse px-4">OFFICIAL PARTNER</Badge>
                <h2 className="text-2xl font-black tracking-tight">{badgeStaff?.username}</h2>
                <p className="text-xs font-mono opacity-70">{badgeStaff?.staff_id}</p>
              </div>
              
              <div className="bg-white p-4 rounded-3xl shadow-xl">
                <QRCodeCanvas 
                  value={`https://shopos-mezo.vercel.app/register?referral_id=${badgeStaff?.staff_id}`}
                  size={180}
                  level="H"
                />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Scan to Register</p>
                <p className="text-xs font-bold opacity-80">Powered by SHOPOS x Mezo Network</p>
              </div>
           </div>
           <div className="bg-slate-50 p-6 flex justify-center">
              <Button onClick={() => window.print()} className="rounded-full gap-2 font-bold">
                <Printer className="w-4 h-4" />
                Print Badge
              </Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Coupon QR Modal */}
      <Dialog open={!!couponQr} onOpenChange={() => setCouponQr(null)}>
        <DialogContent className="max-w-sm rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-orange-600 p-10 text-center text-white space-y-6 flex flex-col items-center">
            <div className="space-y-2">
              <Badge className="bg-white text-orange-700 font-black px-4">COUPON QR</Badge>
              <h2 className="text-2xl font-black tracking-tight">{couponQr?.title}</h2>
              <p className="text-sm font-bold opacity-80">
                Save {couponQr?.discountAmount?.toFixed(2)} MUSD over {couponQr?.minimumSpend?.toFixed(2)} MUSD
              </p>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-xl">
              {couponQrUrl ? (
                <QRCodeCanvas value={couponQrUrl} size={190} level="H" />
              ) : null}
            </div>

            <p className="break-all text-xs font-bold opacity-80">{couponQrUrl}</p>
          </div>
          <div className="bg-slate-50 p-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setCouponQr(null)} className="rounded-full font-bold">
              Close
            </Button>
            <Button onClick={() => window.print()} className="rounded-full gap-2 font-bold">
              <Printer className="w-4 h-4" />
              Print QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="max-w-[280px] break-words text-right font-black text-slate-900">{value}</span>
    </div>
  );
}
