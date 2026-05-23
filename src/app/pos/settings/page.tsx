"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Check, 
  Edit2, 
  Percent, 
  Plus, 
  Printer, 
  QrCode, 
  RefreshCw, 
  Save, 
  Settings, 
  ShieldCheck, 
  Store, 
  Trash2, 
  TrendingUp, 
  Users, 
  Wallet, 
  X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BottomSheetFrame } from '@/components/pos/checkout/BottomSheetFrame';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { QRCodeCanvas } from 'qrcode.react';

export default function PosSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold">Loading Store Configuration...</div>}>
      <PosSettingsContent />
    </Suspense>
  );
}

function PosSettingsContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'settings' | 'staff'>('settings');
  const [loading, setLoading] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<any>({
    Global_Discount_Rate: '0.05',
    Referral_Commission_Rate: '0.05',
    Mezo_Passport_Bonus_Multiplier: '1.2',
    Merchant_Wallet_Address: '0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7'
  });
  
  // Staff State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isStaffDrawerOpen, setIsStaffDrawerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({
    staff_id: '',
    username: '',
    role: 'staff',
    store_id: 'STORE_A'
  });

  // QR Badge State
  const [badgeStaff, setBadgeStaff] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/admin/staff', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setStaffList(data);
      }
    } catch (err: any) {
      console.error('Failed to load staff list:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSettings(), fetchStaff()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettingValue = async (key: string, value: string) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        toast({ title: "Settings Saved", description: `Updated ${key} successfully.` });
        fetchSettings();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update setting.');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message || "Failed to update store settings parameter." });
    }
  };

  const handleStaffSubmit = async () => {
    if (!staffForm.username.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Username cannot be empty.' });
      return;
    }
    if (!staffForm.staff_id.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Staff ID cannot be empty.' });
      return;
    }

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
          description: `${staffForm.username} successfully saved to roster.` 
        });
        setIsStaffDrawerOpen(false);
        setEditingStaff(null);
        setStaffForm({ staff_id: '', username: '', role: 'staff', store_id: 'STORE_A' });
        fetchStaff();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit staff member details.');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: err.message || "Roster database modification failed." });
    }
  };

  const deleteStaff = async (staff: any) => {
    if (!window.confirm(`Are you sure you want to remove staff member [${staff.username}]?`)) return;
    try {
      const res = await fetch(`/api/admin/staff?id=${staff.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "Staff Removed", description: `Roster updated successfully.` });
        fetchStaff();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove staff.');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to delete staff member." });
    }
  };

  const printBadge = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950 pb-safe">
      <Toaster />
      <div className="mx-auto max-w-md space-y-4">
        
        {/* Mobile Header */}
        <header className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3">
            <Link href="/pos/admin-home">
              <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold bg-white text-slate-800 border-slate-200">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">POS Admin</p>
              <h1 className="text-xl font-black text-slate-950">Store Settings</h1>
            </div>
          </div>

          {/* Quick Tabs Controller (Mobile-first Pills) */}
          <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'settings' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Global Config
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'staff' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Staff Roster
            </button>
          </div>
        </header>

        {/* Dynamic Views */}
        {loading ? (
          <div className="rounded-3xl bg-white p-12 text-center text-sm font-bold border border-slate-200/60 text-slate-500 shadow-sm">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-orange-600/40" />
            Loading configuration data...
          </div>
        ) : activeTab === 'settings' ? (
          /* Economic Global Settings View */
          <div className="space-y-3 pb-24">
            {[
              { key: 'Global_Discount_Rate', label: 'Default Discount Rate', icon: <Percent className="w-4 h-4" />, desc: 'Base member discount (e.g. 0.05 = 5%)' },
              { key: 'Referral_Commission_Rate', label: 'Staff Commission Rate', icon: <TrendingUp className="w-4 h-4" />, desc: 'Sales commission slice per transaction (e.g. 0.05)' },
              { key: 'Mezo_Passport_Bonus_Multiplier', label: 'Mezo Passport Multiplier', icon: <ShieldCheck className="w-4 h-4" />, desc: 'Weight incentive multiplier for passport levels' },
              { key: 'Merchant_Wallet_Address', label: 'Merchant Recipient Wallet', icon: <Wallet className="w-4 h-4" />, desc: 'Destination wallet address for all crypto sales' }
            ].map((s) => (
              <Card key={s.key} className="border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden bg-white">
                <CardHeader className="pb-3 border-b border-slate-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <span className="p-2 bg-orange-50 text-orange-600 rounded-xl shrink-0">
                      {s.icon}
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-black text-slate-950">{s.label}</CardTitle>
                      <CardDescription className="text-[10px] font-bold text-slate-500 mt-0.5 leading-normal">{s.desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-3 flex gap-2">
                  <Input 
                    value={settings[s.key] || ''} 
                    onChange={(e) => setSettings({...settings, [s.key]: e.target.value})}
                    className="font-mono text-sm font-bold border-slate-200 h-10 rounded-xl flex-1 bg-white text-slate-950 focus-visible:ring-1 focus-visible:ring-orange-500"
                  />
                  <Button 
                    className="bg-slate-950 text-xs font-black text-white hover:bg-orange-600 rounded-xl h-10 px-4 transition-colors" 
                    onClick={() => updateSettingValue(s.key, settings[s.key])}
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Staff Roster Management View */
          <div className="space-y-3 pb-24">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Active Roster List ({staffList.length})</span>
              <Button 
                onClick={() => {
                  setEditingStaff(null);
                  setStaffForm({ staff_id: '', username: '', role: 'staff', store_id: 'STORE_A' });
                  setIsStaffDrawerOpen(true);
                }}
                className="h-9 px-4 rounded-xl bg-orange-600 text-xs font-black text-white hover:bg-slate-950 gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Member
              </Button>
            </div>

            <div className="space-y-3">
              {staffList.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200/80 bg-white p-8 text-center text-sm font-bold text-slate-400">
                  <Users className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No staff members registered.
                </div>
              ) : (
                staffList.map((staff) => (
                  <article key={staff.id} className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 shrink-0 rounded-2xl bg-orange-100/60 flex items-center justify-center font-black text-orange-700 text-base shadow-sm">
                        {staff.username ? staff.username.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-sm text-slate-950 truncate">{staff.username || 'Staff member'}</p>
                          <Badge variant="outline" className={`capitalize font-bold border-none px-2 py-0.5 text-[9px] ${
                            staff.role === 'admin' ? 'bg-red-50 text-red-700' : 
                            staff.role === 'manager' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                          }`}>
                            {staff.role}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">ID: {staff.staff_id}</p>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mt-1">
                          <Store className="w-3 h-3 text-slate-400" />
                          {staff.store_id || 'STORE_A'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-lg w-8 h-8 hover:bg-orange-50 hover:text-orange-600" 
                        onClick={() => {
                          setEditingStaff(staff);
                          setStaffForm({
                            staff_id: staff.staff_id,
                            username: staff.username,
                            role: staff.role || 'staff',
                            store_id: staff.store_id || 'STORE_A'
                          });
                          setIsStaffDrawerOpen(true);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-lg w-8 h-8 hover:bg-orange-50 hover:text-orange-600" 
                        onClick={() => setBadgeStaff(staff)}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-lg w-8 h-8 hover:bg-red-50 hover:text-red-600" 
                        onClick={() => deleteStaff(staff)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Staff Drawer Form Overlay */}
      <BottomSheetFrame open={isStaffDrawerOpen} title={editingStaff ? 'Update Staff Profile' : 'New Staff Account'} onOpenChange={setIsStaffDrawerOpen}>
        <div className="space-y-5 px-4 pb-10 pt-4">
          <h3 className="text-center text-base font-black text-slate-950">{editingStaff ? 'Update Staff Profile' : 'Add New Staff'}</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Username</label>
              <Input 
                value={staffForm.username} 
                onChange={(e) => setStaffForm({...staffForm, username: e.target.value})} 
                placeholder="e.g. Alice"
                className="h-11 rounded-xl border border-slate-200 font-bold bg-white text-slate-950 focus-visible:ring-1 focus-visible:ring-orange-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Public Staff ID</label>
              <Input 
                value={staffForm.staff_id} 
                onChange={(e) => setStaffForm({...staffForm, staff_id: e.target.value})} 
                placeholder="e.g. STAFF005"
                disabled={!!editingStaff}
                className="h-11 rounded-xl border border-slate-200 font-mono font-bold bg-white text-slate-950 focus-visible:ring-1 focus-visible:ring-orange-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                <Select value={staffForm.role} onValueChange={(val) => setStaffForm({...staffForm, role: val})}>
                  <SelectTrigger className="h-11 rounded-xl border border-slate-200 font-bold bg-white text-slate-950 focus-visible:ring-1 focus-visible:ring-orange-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Store Branch</label>
                <Select value={staffForm.store_id} onValueChange={(val) => setStaffForm({...staffForm, store_id: val})}>
                  <SelectTrigger className="h-11 rounded-xl border border-slate-200 font-bold bg-white text-slate-950 focus-visible:ring-1 focus-visible:ring-orange-500">
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
          <div className="flex flex-col gap-3 pt-3">
            <Button className="h-12 w-full rounded-2xl bg-orange-600 text-sm font-black text-white hover:bg-slate-950 shadow-md transition-colors" onClick={handleStaffSubmit}>
              {editingStaff ? 'Save Changes' : 'Create Account'}
            </Button>
            <Button variant="ghost" className="h-12 w-full rounded-2xl font-bold text-slate-500" onClick={() => setIsStaffDrawerOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </BottomSheetFrame>

      {/* QR Badge Drawer Overlay */}
      <BottomSheetFrame open={!!badgeStaff} title="Staff Badge ID Card" onOpenChange={() => setBadgeStaff(null)}>
        <div className="bg-white px-4 pb-10 pt-4 overflow-hidden rounded-t-[3rem]">
           <div className="bg-slate-950 rounded-[2rem] p-6 text-center text-white space-y-6 flex flex-col items-center shadow-2xl">
              <div className="space-y-1.5">
                <Badge className="bg-orange-600 text-white border-none font-black px-3 py-0.5 rounded-full text-[9px]">OFFICIAL POS STAFF</Badge>
                <h2 className="text-2xl font-black tracking-tight mt-1">{badgeStaff?.username}</h2>
                <p className="text-white/50 text-[9px] font-black uppercase tracking-[0.15em]">{badgeStaff?.role} @ {badgeStaff?.store_id}</p>
              </div>

              <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-orange-50">
                 <QRCodeCanvas 
                    id="badge-qr"
                    value={badgeStaff ? `https://${typeof window !== 'undefined' ? window.location.host : ''}/?staff_promo=${badgeStaff.staff_id}` : ''} 
                    size={160}
                    level="H"
                 />
              </div>

              <div className="space-y-1">
                 <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Employee Referral ID</p>
                 <p className="text-xs font-mono font-medium opacity-70">promo_id: {badgeStaff?.staff_id}</p>
              </div>

              <div className="flex gap-2.5 w-full no-print pt-2">
                 <Button className="flex-1 rounded-xl h-12 bg-orange-600 font-black text-white hover:bg-slate-800 gap-1.5" onClick={printBadge}>
                    <Printer className="w-4 h-4" />
                    Print Badge
                 </Button>
                 <Button variant="ghost" className="bg-white/10 hover:bg-white/20 text-white rounded-xl w-12 h-12 p-0 shrink-0" onClick={() => setBadgeStaff(null)}>
                    <X className="w-5 h-5" />
                 </Button>
              </div>
           </div>
        </div>
      </BottomSheetFrame>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          div[role="dialog"] {
            visibility: visible;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: none !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          div[role="dialog"] * {
            visibility: visible;
            color: black !important;
          }
          .bg-primary {
            background-color: white !important;
          }
          canvas {
            border: 1px solid #eee;
          }
        }
      `}</style>
    </main>
  );
}
