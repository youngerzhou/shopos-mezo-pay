
"use client";

import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Users, QrCode, BarChart3, ArrowLeft, RefreshCw, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function StaffDashboard() {
  const [staffId, setStaffId] = useState('STAFF001');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/stats?staffId=${staffId}`);
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
  }, [staffId]);

  // Generate the referral link
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?promo=${staffId}`
    : `/?promo=${staffId}`;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-black tracking-tight">Staff Dashboard</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchStats()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync Stats
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* QR Code Card */}
          <Card className="md:col-span-1 shadow-sm border-none bg-primary text-primary-foreground overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Referral QR
              </CardTitle>
              <CardDescription className="text-primary-foreground/70">
                Customers scan this to register
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4">
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <QRCodeCanvas 
                  value={referralLink} 
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="mt-6 text-center space-y-2">
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 border-none text-white px-4 py-1">
                  ID: {staffId}
                </Badge>
                <p className="text-[10px] opacity-70 break-all max-w-[200px]">
                  {referralLink}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <div className="md:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Total Referrals</p>
                      <h3 className="text-3xl font-black">{stats?.total_referrals || 0}</h3>
                    </div>
                    <div className="bg-secondary/10 p-3 rounded-2xl">
                      <Users className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Status</p>
                      <div className="flex items-center gap-2">
                         <h3 className="text-xl font-black">Active</h3>
                         <BadgeCheck className="w-5 h-5 text-green-500" />
                      </div>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-2xl">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Recent Bindings</CardTitle>
                <CardDescription>Recently successfully bound customers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.recent_customers?.length > 0 ? (
                    stats.recent_customers.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                            {c.wallet_address.substring(2, 4).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-mono font-bold">
                              {c.wallet_address.substring(0, 8)}...{c.wallet_address.substring(c.wallet_address.length - 8)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Joined {new Date(c.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">Level {c.level}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No customers bound yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
