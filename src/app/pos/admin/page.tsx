"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { 
  Settings, 
  Users, 
  Save, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowLeft, 
  QrCode, 
  Store, 
  ShieldCheck,
  Percent,
  TrendingUp,
  X,
  Printer,
  Wallet,
  PackageCheck
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

export default function PosAdmin() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Control Center...</div>}>
      <PosAdminContent />
    </Suspense>
  );
}

function PosAdminContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'settings' | 'staff'>('settings');
  
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

  useEffect(() => {
    fetchSettings();
    fetchStaff();
  }, []);

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
          <Link href="/pos/pickup-orders">
            <Button className="rounded-md font-black">
              <PackageCheck className="mr-2 h-4 w-4" />
              Pickup Orders
            </Button>
          </Link>
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

      <Toaster />
    </div>
  );
}
