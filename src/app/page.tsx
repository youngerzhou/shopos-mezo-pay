
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShoppingBag, Scan, History, RefreshCw, Activity, Database, CheckCircle2, Ticket, ArrowRight, Wallet, Percent, UserCheck, CreditCard, Sparkles, UserPlus, TrendingUp, Layers, QrCode, Settings, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scanner } from '@/components/Scanner';
import { SuccessFeedback } from '@/components/SuccessFeedback';
import { Order } from '@/app/lib/db';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { WebhookDebugger } from '@/components/WebhookDebugger';
import { QRCodeCanvas } from 'qrcode.react';
import Link from 'next/link';
import { ContractInteraction } from '@/components/ContractInteraction';

export default function ShoposMezo() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    }>
      <ShoposMezoContent />
    </Suspense>
  );
}

function ShoposMezoContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffPromoId = searchParams?.get('staff_promo');
  const promoId = searchParams?.get('promo');
  const activePromo = promoId || staffPromoId;
  
  const userRole = searchParams?.get('role') || 'staff'; // admin, manager, staff
  const storeId = searchParams?.get('store_id') || 'STORE_A';

  const [isRedirecting, setIsRedirecting] = useState(false);

  // Redirection Logic: If a promo code is present and no explicit role is defined, redirect to /register
  useEffect(() => {
    const hasExplicitRole = searchParams?.has('role');
    if (activePromo && !hasExplicitRole) {
      setIsRedirecting(true);
      router.push(`/register?staff_promo=${activePromo}`);
    }
  }, [activePromo, router, searchParams]);
  
  const [viewMode, setViewMode] = useState<'pos'>('pos');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<1 | 2>(1);
  const [scannedCustomerId, setScannedCustomerId] = useState<string | null>(null);
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [progress, setProgress] = useState(10);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [merchantAddress, setMerchantAddress] = useState<string>('0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7');

  const DEFAULT_PRICE = 1;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.Merchant_Wallet_Address) {
        setMerchantAddress(data.Merchant_Wallet_Address);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  useEffect(() => {
    if (!order || isPaid) return;

    setSseStatus('connecting');
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events?orderId=${order.id}`, { cache: 'no-store' });
        if (!res.ok) {
          setSseStatus('error');
          return;
        }
        
        const data = await res.json();
        setSseStatus('connected');
        setLastHeartbeat(new Date().toLocaleTimeString());
        
        if (data.status === 'paid' || data.status === 'success') {
          setProgress(100);
          clearInterval(pollInterval);
          setTimeout(() => setIsPaid(true), 800);
        } else {
          setProgress(prev => (prev < 95 ? prev + 0.5 : prev));
        }
      } catch (err) {
        console.error('Polling error:', err);
        setSseStatus('error');
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [order, isPaid]);

  const handleScanSuccess = async (data: string) => {
    setIsScanning(false);
    
    if (scanStep === 1) {
      // Step 1: Scan Member Card (starts with MEM_)
      if (data.startsWith('MEM_')) {
        setScannedCustomerId(data);
        setScanStep(2);
        toast({
          title: "Member Identified",
          description: "5% Discount Applied. Now scan payment wallet.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Card",
          description: "Please scan a valid Mezo Member QR code.",
        });
      }
    } else {
      // Step 2: Scan Payment Wallet
      setLoading(true);
      setProgress(20);
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customerId: scannedCustomerId,
            walletAddress: data.trim().toLowerCase(), 
            amount: DEFAULT_PRICE 
          }),
        });
        
        const orderData = await res.json();
        if (!res.ok) throw new Error(orderData.error || 'Checkout failed');
        
        setOrder(orderData);
        
        // Handle Fast Pay (Alipay Mode)
        if (orderData.fast_pay_triggered) {
          toast({
            title: "Fast Pay Executed!",
            description: "Alipay mode active. Pull payment initiated from customer wallet.",
          });
          setProgress(100);
          setTimeout(() => setIsPaid(true), 1500);
          return;
        }

        // Handle Wallet Auto-Lookup Result
        if (orderData.customer_id && !scannedCustomerId) {
          setScannedCustomerId(orderData.customer_id);
          toast({
            title: "Member Recognized!",
            description: "Member discount automatically applied via linked wallet.",
          });
        }

        if (orderData.passport_level) {
          toast({
            title: "Mezo Passport Detected!",
            description: `Auto-bind successful. Multiplier applied.`,
          });
        }
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Checkout Error",
          description: err.message
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePaymentSuccess = async (txHash: string) => {
    if (!order) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: 'paid',
          txHash
        })
      });
      
      if (res.ok) {
        setProgress(100);
        setTimeout(() => setIsPaid(true), 800);
        toast({
          title: "Payment Confirmed!",
          description: "Transaction successfully recorded on the Mezo blockchain.",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Payment succeeded but database update failed. Please notify management."
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    toast({
      variant: "destructive",
      title: "Payment Failed",
      description: error.includes('rejected') ? "Transaction rejected by user." : "Check your balance or network connection."
    });
  };

  const resetPOS = () => {
    setOrder(null);
    setIsPaid(false);
    setIsScanning(false);
    setScanStep(1);
    setScannedCustomerId(null);
    setProgress(10);
    setLastHeartbeat(null);
    setViewMode('pos');
  };

  if (isPaid) return <SuccessFeedback onDone={resetPOS} />;
  
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center shadow-xl animate-bounce">
          <UserPlus className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-primary">Joining Ecosystem...</h2>
          <p className="text-sm text-muted-foreground font-medium">Redirecting you to the Mezo Registration portal.</p>
        </div>
        <RefreshCw className="w-6 h-6 animate-spin text-primary/20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto shadow-2xl border-x border-border/50">
      <Toaster />
      <header className="p-6 border-b flex justify-between items-start sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Shopos Mezo</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
              {userRole === 'admin' ? 'Admin Controller' : userRole === 'manager' ? 'Store Manager' : 'Staff Terminal'}
            </p>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <WebhookDebugger />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <div className="flex gap-1">
              <Link href="/admin/dashboard">
                <Button size="icon" variant="outline" className="rounded-full shadow-sm">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </Button>
              </Link>
              <Link href="/admin/settings">
                <Button size="icon" variant="outline" className="rounded-full shadow-sm">
                  <Settings className="w-4 h-4 text-slate-500" />
                </Button>
              </Link>
            </div>
          )}
          {userRole === 'manager' && (
            <Link href={`/manager/dashboard?storeId=${storeId}`}>
              <Button size="icon" variant="outline" className="rounded-full shadow-sm">
                <Layers className="w-4 h-4 text-secondary" />
              </Button>
            </Link>
          )}
          {userRole === 'staff' && (
             <Link href="/staff/dashboard">
              <Button size="icon" variant="outline" className="rounded-full shadow-sm">
                <QrCode className="w-4 h-4 text-primary" />
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm border" onClick={resetPOS}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-24">
        {!order ? (
          <div className="space-y-6">
            <Card className="overflow-hidden border-none shadow-xl bg-primary text-white">
              <div className="p-6 pt-10 flex justify-between items-end">
                <div>
                  <p className="text-white/60 text-[10px] uppercase font-bold mb-1">POS Checkout</p>
                  <p className="text-5xl font-black tracking-tighter">{DEFAULT_PRICE.toFixed(2)} MUSD</p>
                </div>
                <ShoppingBag className="w-12 h-12 opacity-20" />
              </div>
              <div className="bg-black/10 p-4 flex gap-4">
                <div className="flex-1 flex flex-col items-center gap-1">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${scanStep >= 1 ? 'bg-secondary text-primary' : 'bg-white/20'}`}>1</div>
                   <p className="text-[8px] font-bold uppercase opacity-50">Identity</p>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${scanStep >= 2 ? 'bg-secondary text-primary' : 'bg-white/20'}`}>2</div>
                   <p className="text-[8px] font-bold uppercase opacity-50">Payment</p>
                </div>
              </div>
            </Card>

              <div className="grid grid-cols-1 gap-4">
                {userRole === 'admin' && (
                  <Link href="/admin/settings">
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="w-full h-16 rounded-2xl text-sm font-bold border-dashed border-2 border-primary/20 hover:border-primary/50 text-primary flex items-center gap-2 mb-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Global Control Panel</span>
                    </Button>
                  </Link>
                )}

                <div className="space-y-4">
                  <Button 
                    size="lg" 
                    variant={scanStep === 1 ? "default" : "outline"}
                    disabled={scanStep !== 1}
                    className={`w-full h-24 rounded-3xl text-xl font-bold flex flex-col gap-1 transition-all ${scanStep === 1 ? 'shadow-lg scale-[1.02] border-none bg-primary' : 'opacity-50'}`}
                    onClick={() => setIsScanning(true)}
                  >
                    <div className="flex items-center gap-3">
                      <UserCheck className="w-8 h-8" />
                      <span>Step 1: Member Scan</span>
                    </div>
                    <p className="text-[10px] uppercase opacity-60">Apply 5% Discount</p>
                  </Button>

                  {scanStep === 1 && (
                    <div className="grid grid-cols-2 gap-3">
                       <Button 
                          variant="outline" 
                          className="rounded-2xl h-12 text-xs font-bold border-dashed text-muted-foreground"
                          onClick={() => {
                            setScannedCustomerId(null);
                            setScanStep(2);
                            toast({ title: "Guest Checkout", description: "Proceeding without member discount." });
                          }}
                       >
                         Skip Membership
                       </Button>
                       <Link href={`/register${staffPromoId ? `?staff_promo=${staffPromoId}` : ''}`} className="w-full">
                         <Button variant="outline" className="w-full rounded-2xl h-12 text-xs font-bold bg-secondary/5 border-secondary/20 text-secondary">
                            New Member?
                         </Button>
                       </Link>
                    </div>
                  )}
                </div>

                <Button 
                  size="lg" 
                  variant={scanStep === 2 ? "default" : "outline"}
                  disabled={scanStep !== 2}
                  className={`h-24 rounded-3xl text-xl font-bold flex flex-col gap-1 transition-all ${scanStep === 2 ? 'shadow-lg scale-[1.02] border-none bg-secondary text-primary' : 'opacity-50'}`}
                  onClick={() => setIsScanning(true)}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-8 h-8" />
                    <span>Step 2: Wallet Scan</span>
                  </div>
                  <p className="text-[10px] uppercase opacity-60">Finalize Payment</p>
                </Button>
              </div>

            {scannedCustomerId && (
              <div className="p-4 bg-secondary/10 rounded-2xl border border-secondary/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className="bg-secondary text-primary font-black">MEMBER</Badge>
                  <p className="text-xs font-mono font-bold">{scannedCustomerId}</p>
                </div>
                <Sparkles className="w-5 h-5 text-secondary animate-pulse" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
               <CardHeader className="pb-2 bg-muted/20 border-b">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Waiting for Payment</span>
                  {scannedCustomerId ? (
                    <Badge className="text-[9px] bg-secondary text-primary">ID: {scannedCustomerId}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] opacity-50 uppercase font-bold">Guest Checkout</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="text-center space-y-4">
                  <div className="space-y-1">
                    <p className="text-5xl font-black text-primary tracking-tighter">{order.amount_musd.toFixed(2)} MUSD</p>
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
                      <span className="line-through">{order.original_amount?.toFixed(2)} MUSD</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="text-secondary">-{Math.round((order.discount_rate || 0) * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-muted/30 p-2 px-4 rounded-full inline-flex items-center gap-2 border">
                    <BadgeCheck className="w-3 h-3 text-secondary" />
                    <span className="text-[9px] font-bold text-primary truncate max-w-[200px]">{order.wallet_address}</span>
                  </div>
                </div>

                  <div className="space-y-4">
                     <div className="relative">
                      <Progress value={progress} className="h-2 bg-muted" />
                    </div>
                    
                    <ContractInteraction 
                      orderId={order.id}
                      amount={order.amount_musd}
                      merchantAddress={merchantAddress}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />

                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-dashed text-center">
                      <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
                      <p className="text-[10px] text-muted-foreground font-medium text-left">
                        Awaiting on-chain confirmation for <b>{order.amount_musd.toFixed(2)} MUSD</b>.
                      </p>
                    </div>
                  </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {isScanning && (
        <Scanner onScan={handleScanSuccess} onClose={() => setIsScanning(false)} />
      )}

      {loading && (
        <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-md flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <RefreshCw className="w-12 h-12 text-secondary animate-spin" />
            <p className="text-sm font-black text-primary uppercase tracking-widest">Processing Transaction...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BadgeCheck({ className }: { className?: string }) {
  return <CheckCircle2 className={className} />;
}
