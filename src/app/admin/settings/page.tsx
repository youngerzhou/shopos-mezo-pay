
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
  Printer
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

export default function AdminSettings() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Control Center...</div>}>
      <AdminSettingsContent />
    </Suspense>
  );
}

function AdminSettingsContent() {
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
        toast({ title: "Staff Removed" });
        fetchStaff();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const printBadge = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      
      {/* Mobile-friendly Sidebar/Nav */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row min-h-screen">
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-6 space-y-8">
          <div className="flex items-center gap-3">
             <Link href="/admin/dashboard">
               <Button variant="ghost" size="icon" className="rounded-full">
                 <ArrowLeft className="w-4 h-4" />
               </Button>
             </Link>
             <h2 className="text-xl font-black tracking-tight text-primary">System Admin</h2>
          </div>

          <nav className="space-y-2">
            <Button 
              variant={activeTab === 'settings' ? 'default' : 'ghost'} 
              className="w-full justify-start gap-2 font-bold"
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="w-4 h-4" />
              Global Config
            </Button>
            <Button 
              variant={activeTab === 'staff' ? 'default' : 'ghost'} 
              className="w-full justify-start gap-2 font-bold"
              onClick={() => setActiveTab('staff')}
            >
              <Users className="w-4 h-4" />
              Staff Roster
            </Button>
          </nav>

          <div className="pt-8 border-t border-slate-100">
             <div className="p-4 bg-primary/5 rounded-2xl">
                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-2">Network Status</p>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-xs font-bold text-primary">Live Mainnet Sync</span>
                </div>
             </div>
          </div>
        </aside>

        <main className="flex-1 p-6 md:p-10 pb-20">
          {activeTab === 'settings' ? (
            <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="space-y-1">
                 <h1 className="text-4xl font-black tracking-tight text-primary">Global Settings</h1>
                 <p className="text-muted-foreground font-medium">Control the economic parameters of the Shopos ecosystem.</p>
               </div>

               <div className="grid grid-cols-1 gap-6">
                 {[
                   { key: 'Global_Discount_Rate', label: 'Default Discount Rate', icon: <Percent className="w-5 h-5" />, desc: 'Base discount for all members (decimal format: 0.05 = 5%)' },
                   { key: 'Referral_Commission_Rate', label: 'Staff Commission', icon: <TrendingUp className="w-5 h-5" />, desc: 'Revenue share per successful transaction (decimal)' },
                   { key: 'Mezo_Passport_Bonus_Multiplier', label: 'Passport Multiplier', icon: <ShieldCheck className="w-5 h-5" />, desc: 'Extra bonus weight for high-level passport holders' },
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

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Store</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {staffList.map((staff) => (
                      <tr key={staff.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary">
                               {staff.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                               <p className="font-bold text-slate-700">{staff.username}</p>
                               <p className="text-[10px] font-mono text-slate-400">{staff.staff_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                           <Badge variant="outline" className={`capitalize font-bold border-none ${
                             staff.role === 'admin' ? 'bg-red-50 text-red-600' : 
                             staff.role === 'manager' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                           }`}>
                             {staff.role}
                           </Badge>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Store className="w-3 h-3" />
                            {staff.store_id}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                           <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 hover:text-primary" onClick={() => {
                             setEditingStaff(staff);
                             setStaffForm({
                               staff_id: staff.staff_id,
                               username: staff.username,
                               role: staff.role || 'staff',
                               store_id: staff.store_id || 'STORE_A'
                             });
                             setIsStaffModalOpen(true);
                           }}>
                             <Edit2 className="w-4 h-4" />
                           </Button>
                           <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary/5 hover:text-secondary" onClick={() => setBadgeStaff(staff)}>
                             <QrCode className="w-4 h-4" />
                           </Button>
                           <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 hover:text-red-600" onClick={() => deleteStaff(staff.id)}>
                             <Trash2 className="w-4 h-4" />
                           </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Staff Modal */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">{editingStaff ? 'Update Profile' : 'New Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Username</label>
              <Input 
                value={staffForm.username} 
                onChange={(e) => setStaffForm({...staffForm, username: e.target.value})} 
                placeholder="e.g. Alice"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Public Staff ID</label>
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
                <h2 className="text-3xl font-black tracking-tight">{badgeStaff?.username}</h2>
                <p className="text-white/50 text-xs font-medium uppercase tracking-[0.2em]">{badgeStaff?.role} @ {badgeStaff?.store_id}</p>
              </div>

              <div className="p-8 bg-white rounded-[2.5rem] shadow-xl border-8 border-primary/20">
                 <QRCodeCanvas 
                    id="badge-qr"
                    value={badgeStaff ? `https://${typeof window !== 'undefined' ? window.location.host : ''}/?staff_promo=${badgeStaff.staff_id}` : ''} 
                    size={200}
                    level="H"
                 />
              </div>

              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Unique Referral Link</p>
                 <p className="text-xs font-mono font-medium opacity-70">shopos.mezo/?staff_promo={badgeStaff?.staff_id}</p>
              </div>

              <div className="flex gap-2 w-full no-print">
                 <Button variant="secondary" className="flex-1 rounded-2xl h-12 font-bold gap-2 text-primary" onClick={printBadge}>
                   <Printer className="w-4 h-4" />
                   Print Badge
                 </Button>
                 <Button variant="ghost" className="bg-white/10 hover:bg-white/20 text-white rounded-2xl w-12 h-12 p-0" onClick={() => setBadgeStaff(null)}>
                   <X className="w-5 h-5" />
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
