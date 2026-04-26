"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserPlus, Sparkles, CheckCircle2, Ticket, Smartphone, Mail, ArrowRight, UserCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const staffPromoId = searchParams?.get('staff_promo');
  const { toast } = useToast();

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [staffName, setStaffName] = useState<string>('');
  const [formData, setFormData] = useState({
    username: '',
    contact: ''
  });
  const [newMember, setNewMember] = useState<any>(null);

  useEffect(() => {
    if (staffPromoId) {
      fetchStaffInfo();
    }
  }, [staffPromoId]);

  const fetchStaffInfo = async () => {
    try {
      const res = await fetch(`/api/register?staff_id=${staffPromoId}`);
      const data = await res.json();
      setStaffName(data.username);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.contact) {
      toast({ variant: "destructive", title: "Wait!", description: "Please fill in all fields." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          staff_id: staffPromoId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNewMember(data);
        setStep('success');
        toast({ title: "Welcome to ShopOS!", description: "Your member profile is ready." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to register. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 max-w-md mx-auto shadow-2xl border-x border-border/50">
      <Toaster />
      
      <header className="py-12 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
          <UserPlus className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-primary">ShopOS Mezo</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">Customer Onboarding</p>
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                    Welcome to ShopOS Mezo!
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    {staffName ? `You've been invited by ${staffName}.` : 'Join the Mezo ecosystem today.'}
                  </p>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/5 py-1 px-3 rounded-full inline-block">
                    Instant 5% Discount
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Name</label>
                    <div className="relative">
                      <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="e.g. Satoshi" 
                        className="h-14 rounded-2xl pl-12 border-slate-200 focus:ring-primary/20"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Info (Phone/Email)</label>
                    <div className="relative">
                      {formData.contact.includes('@') ? (
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      ) : (
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      )}
                      <Input 
                        placeholder="e.g. +1 234 567 890" 
                        className="h-14 rounded-2xl pl-12 border-slate-200 focus:ring-primary/20"
                        value={formData.contact}
                        onChange={(e) => setFormData({...formData, contact: e.target.value})}
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 gap-2 mt-4"
                  >
                    {loading ? 'Registering...' : 'Claim My Member Card'}
                    <Sparkles className="w-5 h-5 fill-white" />
                  </Button>
                </form>
              </div>

              <div className="px-8 flex items-center gap-4 py-4 bg-primary/5 rounded-3xl border border-primary/10">
                <Ticket className="w-10 h-10 text-primary shrink-0" />
                <div>
                   <p className="text-xs font-black text-primary uppercase">Referral Bonus</p>
                   <p className="text-[10px] font-medium text-primary/60">Share your digital card after registration to earn commissions.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-8 w-full"
            >
              <div className="w-full bg-slate-900 rounded-[3rem] p-0 text-white shadow-2xl overflow-hidden relative border border-white/5 h-[500px] flex flex-col">
                <div className="bg-primary p-10 h-1/2 flex flex-col items-center justify-center text-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-10">
                     <Sparkles className="w-32 h-32" />
                  </div>
                  <div className="space-y-3 z-10">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-xl">
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight leading-none mb-1">Active Member</h2>
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] leading-none">Mezo Network Loyalty</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-white flex flex-col items-center justify-center -mt-8 rounded-t-[3rem] p-8 space-y-6">
                  <div className="p-4 bg-white rounded-3xl shadow-xl border-4 border-slate-50">
                    <QRCodeCanvas 
                      value={newMember?.referral_id || ''} 
                      size={180}
                      level="H"
                    />
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 font-black uppercase tracking-widest leading-none">Member Identifier</p>
                    <p className="text-2xl font-black tracking-tighter text-slate-800">{newMember?.referral_id}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border-t p-6 pb-8">
                   <div className="flex justify-between items-center px-4">
                    <div className="text-left">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Card Holder</p>
                       <p className="font-bold text-slate-800 text-sm">{newMember?.username}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Reward</p>
                       <p className="font-bold text-primary text-sm">5% Off</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 w-full">
                <Button 
                   className="w-full h-16 rounded-2xl font-black gap-3 bg-black hover:bg-zinc-900 border-none shadow-xl shadow-black/10 overflow-hidden relative group"
                   onClick={() => {
                     toast({
                       title: "Request Sent",
                       description: "Apple Wallet pass generation started. Check your notifications.",
                     });
                   }}
                >
                  <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  Add to Apple Wallet
                  <div className="absolute right-0 top-0 h-full w-12 bg-white/5 -skew-x-12 translate-x-12 group-hover:translate-x-0 transition-transform duration-500" />
                </Button>

                <Button variant="outline" className="w-full h-16 rounded-2xl font-black gap-2 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" onClick={() => window.location.href = '/'}>
                  Start Shopping
                  <ArrowRight className="w-4 h-4" />
                </Button>
                
                <p className="text-[10px] text-center text-muted-foreground font-bold px-8 uppercase tracking-widest opacity-50">
                   Secured by Mezo Infrastructure
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Mezo Network Secured</p>
      </footer>
    </div>
  );
}
