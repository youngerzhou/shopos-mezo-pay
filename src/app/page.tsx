
"use client";

import React, { useState, useEffect } from 'react';
import { ShoppingBag, Scan, History, RefreshCw, Activity, Database, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Scanner } from '@/components/Scanner';
import { SuccessFeedback } from '@/components/SuccessFeedback';
import { Order } from '@/app/lib/db';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { WebhookDebugger } from '@/components/WebhookDebugger';

export default function ShoposMezo() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [progress, setProgress] = useState(10);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);

  // Default Price: 1 MUSD
  const DEFAULT_PRICE = 1;

  useEffect(() => {
    if (!order || isPaid) return;

    setSseStatus('connecting');
    const eventSource = new EventSource(`/api/events?orderId=${order.id}`);

    eventSource.onopen = () => {
      setSseStatus('connected');
      setProgress(40);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastHeartbeat(new Date().toLocaleTimeString());
        
        if (data.status === 'paid' || data.status === 'success') {
          setProgress(100);
          setTimeout(() => setIsPaid(true), 1000);
          eventSource.close();
        } else {
          // Slowly increase progress to show activity if we are just receiving heartbeats
          setProgress(prev => {
            if (prev < 90) return prev + 1;
            return prev;
          });
        }
      } catch (err) {
        console.error('SSE data parse error:', err);
      }
    };

    eventSource.onerror = (e) => {
      console.error('SSE Connection Error:', e);
      setSseStatus('error');
    };

    return () => eventSource.close();
  }, [order, isPaid]);

  const handleScanSuccess = async (address: string) => {
    setIsScanning(false);
    setLoading(true);
    setProgress(20);

    const normalizedAddress = address.trim().toLowerCase();

    try {
      // Create real order in SQLite
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: normalizedAddress, amount: DEFAULT_PRICE }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Order initialization failed');
      
      setOrder(data);
      // Removed any simulation block. Now waiting for real Webhook.

    } catch (err: any) {
      console.error('handleScanSuccess Error:', err);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: err.message || "Failed to contact retail server."
      });
      resetPOS();
    } finally {
      setLoading(false);
    }
  };

  const resetPOS = () => {
    setOrder(null);
    setIsPaid(false);
    setIsScanning(false);
    setProgress(10);
    setLastHeartbeat(null);
  };

  if (isPaid) return <SuccessFeedback onDone={resetPOS} />;

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto shadow-2xl border-x border-border/50">
      <Toaster />
      <header className="p-6 pt-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Shopos Mezo</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Retail Terminal v1.4</p>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <WebhookDebugger />
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border">
          <History className="w-5 h-5 text-primary/40" />
        </div>
      </header>

      <main className="flex-1 px-6 pb-24">
        {!order ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="overflow-hidden border-none shadow-xl bg-primary text-white">
              <div className="aspect-video bg-[url('https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600')] bg-cover bg-center">
                <div className="w-full h-full bg-black/40 p-6 flex flex-col justify-end">
                  <h2 className="text-2xl font-bold">Checkout</h2>
                  <p className="text-white/70 text-sm">Mezo Chain Payment</p>
                </div>
              </div>
              <CardContent className="p-6 flex justify-between items-center">
                <div>
                  <p className="text-white/60 text-[10px] uppercase font-bold mb-1">Total Due</p>
                  <p className="text-4xl font-bold">{DEFAULT_PRICE} MUSD</p>
                </div>
                <ShoppingBag className="w-8 h-8 opacity-20" />
              </CardContent>
            </Card>

            <Button 
              size="lg" 
              className="w-full h-24 rounded-3xl bg-secondary hover:bg-secondary/90 text-2xl font-bold shadow-lg flex items-center justify-center gap-4 transition-all active:scale-95"
              onClick={() => setIsScanning(true)}
            >
              <Scan className="w-10 h-10" />
              <span>Scan to Pay</span>
            </Button>
            
            <div className="p-4 bg-muted/30 rounded-2xl border border-dashed text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">LIVE NETWORK MODE</p>
              <p className="text-[9px] text-muted-foreground mt-1 leading-tight">Waiting for real on-chain transaction logs via Webhook.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="pb-2 bg-muted/20 border-b">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Neon Serverless Storage</span>
                  </div>
                  <Badge variant={sseStatus === 'connected' ? 'secondary' : 'destructive'} className="text-[9px] py-0 px-2 h-5">
                    {sseStatus === 'connected' ? <Activity className="w-2.5 h-2.5 mr-1 animate-pulse" /> : null}
                    {sseStatus === 'connected' ? 'LIVE' : 'RECONNECTING'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 pt-10">
                <div className="text-center">
                  <p className="text-6xl font-black text-primary mb-3 tracking-tighter">{order.amount_musd} MUSD</p>
                  <div className="inline-flex flex-col items-center">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Payer Address</p>
                    <p className="text-[10px] text-primary font-mono bg-muted/50 py-1.5 px-4 rounded-full border">
                      {order.wallet_address.substring(0, 10)}...{order.wallet_address.substring(order.wallet_address.length - 10)}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="relative">
                    <Progress value={progress} className="h-4 bg-muted" />
                    <p className="absolute right-0 -top-6 text-[10px] font-bold text-muted-foreground">Network Sync: {Math.round(progress)}%</p>
                  </div>
                  
                  <div className="flex items-center gap-5 p-5 bg-secondary/5 rounded-3xl border border-secondary/10">
                    <div className="bg-white p-2.5 rounded-xl shadow-sm border border-secondary/20">
                      <RefreshCw className="w-6 h-6 text-secondary animate-spin shrink-0" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-primary leading-none">Awaiting Confirmations</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Listening for Goldsky Webhook signals.
                        {lastHeartbeat && <span className="block mt-1 text-secondary font-medium">Last pulse: {lastHeartbeat}</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed">
                   <div className="flex justify-between items-center text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                      <span>Order ID: {order.id}</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Backend Ready</span>
                   </div>
                </div>
              </CardContent>
            </Card>
            <Button variant="ghost" className="w-full text-muted-foreground font-bold h-12 hover:bg-destructive/10 hover:text-destructive rounded-2xl" onClick={resetPOS}>
              Cancel and Void Order
            </Button>
          </div>
        )}
      </main>

      {isScanning && (
        <Scanner onScan={handleScanSuccess} onClose={() => setIsScanning(false)} />
      )}

      {loading && (
        <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center animate-pulse">
               <RefreshCw className="w-12 h-12 text-secondary animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-primary uppercase tracking-[0.3em]">Creating Order...</p>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium">Synchronizing with Local DB</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
