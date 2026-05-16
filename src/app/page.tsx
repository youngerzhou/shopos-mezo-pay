"use client";

import Link from 'next/link';
import { LogIn, Store, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ShoposHome() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">
        <main className="flex flex-1 flex-col justify-center p-6">
          <div className="mb-8 space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Store className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">SHOPOS Mezo</p>
              <h1 className="text-3xl font-black tracking-tight">Staff Terminal</h1>
            </div>
          </div>

          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Signed in as</p>
                  <h2 className="mt-1 truncate text-xl font-black">demo_staff</h2>
                  <p className="text-sm font-medium text-slate-500">Staff ID: STAFF001</p>
                </div>
                <Badge className="shrink-0 bg-emerald-100 text-emerald-800">
                  <UserCheck className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              </div>

              <Link href="/pos/scan" className="block">
                <Button className="h-14 w-full rounded-lg bg-slate-950 text-base font-black text-white">
                  <LogIn className="mr-2 h-5 w-5" />
                  Login SHOPOS
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
