
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, TrendingUp, Users, ShoppingBag, ArrowLeft, RefreshCw, Layers, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading Admin Dashboard...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function AdminDashboardContent() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stats?role=admin');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-black tracking-tighter">Global Treasury</h1>
          </div>
          <Badge className="bg-primary text-primary-foreground px-4 py-1 rounded-full font-bold">ADMIN CONSOLE</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Global Revenue</p>
              <h3 className="text-4xl font-black tracking-tighter">{(stats?.total_revenue || 0).toFixed(2)} MUSD</h3>
              <div className="flex items-center gap-1 mt-4 text-xs font-medium opacity-80">
                <TrendingUp className="w-4 h-4" />
                <span>+12.5% from last week</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Referrals</p>
                    <h3 className="text-4xl font-black">{stats?.total_referrals || 0}</h3>
                  </div>
                  <div className="p-3 bg-secondary/10 rounded-2xl">
                    <Users className="w-6 h-6 text-secondary" />
                  </div>
               </div>
            </CardContent>
          </Card>

           <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Active Stores</p>
                    <h3 className="text-4xl font-black">{stats?.store_stats?.length || 0}</h3>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-2xl">
                    <Globe className="w-6 h-6 text-purple-600" />
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Store Performance Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats?.store_stats?.map((store: any, idx: number) => (
              <Card key={idx} className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">Store {store.store_id}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">Revenue</span>
                    <span className="font-bold text-primary">{(store.store_revenue || 0).toFixed(2)} MUSD</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">Customers</span>
                    <span className="font-bold text-secondary">{store.customer_count || 0}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.min(100, (store.store_revenue / 100) * 100)}%` }} 
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
