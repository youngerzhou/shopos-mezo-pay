
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, BarChart3, TrendingUp, ArrowLeft, RefreshCw, Star, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ManagerDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Initializing Manager Portal...</div>}>
      <ManagerDashboardContent />
    </Suspense>
  );
}

function ManagerDashboardContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId') || 'STORE_A';
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?role=manager&storeId=${storeId}`);
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
  }, [storeId]);

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-black tracking-tight">Store Ops</h1>
          </div>
          <Badge variant="secondary" className="bg-secondary/20 text-secondary border-none px-4 py-1 font-bold">
            MANAGER: {storeId}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Store Volume</p>
                  <h3 className="text-4xl font-black text-primary">{(stats?.store_revenue || 0).toFixed(2)} MUSD</h3>
                </div>
                <div className="p-4 bg-green-500/10 rounded-3xl">
                  <BarChart3 className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
             <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Team Performance</p>
                  <h3 className="text-4xl font-black text-primary">{stats?.staff_performance?.length || 0} Members</h3>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-3xl">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Staff Leaderboard</CardTitle>
            <CardDescription>Referral success per team member</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.staff_performance?.map((staff: any, idx: number) => (
                <div key={staff.staff_id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center font-black text-secondary">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-primary">{staff.username}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {staff.staff_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-primary">{staff.total_referrals}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Referrals</p>
                  </div>
                </div>
              ))}
              {(!stats?.staff_performance || stats.staff_performance.length === 0) && (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                   <Info className="w-10 h-10 opacity-20 mb-2" />
                   <p className="text-sm">No performance data available for this store.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
