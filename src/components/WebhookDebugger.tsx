
"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function WebhookDebugger() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debug/webhooks');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch webhook logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-[10px] h-8 gap-2 bg-white/50 border-dashed border-primary/20 hover:bg-white"
          onClick={fetchLogs}
        >
          <Terminal className="w-3 h-3" />
           Goldsky Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center pr-8">
            <DialogTitle className="flex items-center gap-2">
               <ShieldAlert className="w-5 h-5 text-secondary" />
               Goldsky Webhook Status
            </DialogTitle>
            <Button size="icon" variant="ghost" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 mt-2">
          <p className="text-[10px] font-bold text-primary uppercase mb-2">Goldsky Webhook Endpoint</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white p-2.5 rounded-xl border font-mono text-[11px] text-primary break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook` : '...'}
            </div>
            <Button 
              size="sm" 
              variant="secondary" 
              className="text-[10px] h-9"
              onClick={() => {
                const url = `${window.location.origin}/api/webhook`;
                navigator.clipboard.writeText(url);
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground mt-2 font-medium">Use this URL in your Goldsky Sink configuration to receive payment notifications.</p>
        </div>
        
        <ScrollArea className="flex-1 mt-4 rounded-xl border bg-muted/20 p-4">
          <div className="space-y-4">
            {logs.length === 0 && !loading && (
              <div className="text-center py-20 bg-white/50 rounded-2xl border border-dashed">
                <p className="text-sm text-muted-foreground">No webhooks received yet.</p>
                <p className="text-[10px] text-muted-foreground uppercase mt-1">Waiting for Goldsky activity...</p>
              </div>
            )}
            
            {logs.map((log) => {
              const payload = JSON.parse(log.payload);
              return (
                <div key={log.id} className="p-4 bg-white rounded-2xl border shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="font-mono text-[9px]">
                      ID: {log.id}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.received_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre">
                    {JSON.stringify(payload, null, 2)}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
