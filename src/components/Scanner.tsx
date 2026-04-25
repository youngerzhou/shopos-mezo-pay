
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ScannerProps {
  onScan: (address: string) => void;
  onClose: () => void;
}

export function Scanner({ onScan, onClose }: ScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isHandlingScan = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (isHandlingScan.current) return;
            isHandlingScan.current = true;
            
            // Immediately attempt to stop to avoid double scanning or UI lag
            onScan(decodedText);
            stopScanner();
          },
          () => {} // Quietly ignore frame errors
        );
        setHasCameraPermission(true);
      } catch (err) {
        console.error('Scanner start error:', err);
        setError('Camera access failed. Check browser permissions.');
        setHasCameraPermission(false);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [onScan]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-muted rounded-2xl overflow-hidden border-4 border-secondary shadow-2xl aspect-square">
        <div id="qr-reader" className="w-full h-full" />
        
        {(!hasCameraPermission && !error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-6 text-center">
            <Camera className="w-12 h-12 mb-4 animate-pulse" />
            <p className="font-medium">Requesting Camera Access...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Camera Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-secondary rounded-lg animate-pulse" />
        </div>
      </div>

      <p className="mt-6 text-white/70 text-sm font-medium animate-pulse">
        Align Mezo QR code within the frame
      </p>

      <Button 
        onClick={onClose} 
        variant="ghost" 
        className="mt-8 text-white hover:bg-white/10"
      >
        <X className="mr-2 h-4 w-4" /> Cancel
      </Button>
    </div>
  );
}
