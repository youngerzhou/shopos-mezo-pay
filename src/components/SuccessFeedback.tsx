
"use client";

import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessFeedbackProps {
  onDone: () => void;
}

export function SuccessFeedback({ onDone }: SuccessFeedbackProps) {
  useEffect(() => {
    // Play sound logic
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.play();
    } catch (e) {
      console.log('Audio playback blocked or failed');
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="w-32 h-32 bg-secondary/10 rounded-full flex items-center justify-center mb-8 animate-bounce">
        <CheckCircle2 className="w-20 h-20 text-secondary" />
      </div>
      <h1 className="text-4xl font-bold font-headline mb-4 text-primary">Payment Received!</h1>
      <p className="text-muted-foreground text-lg mb-12 max-w-xs">
        Your Mezo transaction has been confirmed successfully.
      </p>
      <div className="space-y-4 w-full max-w-xs">
        <Button 
          onClick={onDone} 
          size="lg" 
          className="w-full h-14 text-lg bg-secondary hover:bg-secondary/90 shadow-lg shadow-secondary/20"
        >
          New Transaction
        </Button>
        <Button 
          variant="outline" 
          className="w-full h-12"
          onClick={() => window.open('https://explorer.mezo.org', '_blank')}
        >
          View on Explorer
        </Button>
      </div>
    </div>
  );
}
