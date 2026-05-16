
"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ScannerProps {
  onScan: (address: string) => void | Promise<void>;
  onClose: () => void;
}

export function Scanner({ onScan, onClose }: ScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isHandlingScan = useRef(false);
  const isMounted = useRef(true);

  const stopMediaTracks = useCallback(() => {
    const container = document.getElementById('qr-reader');
    if (!container) return;

    const videos = container.querySelectorAll('video');
    videos.forEach((video) => {
      const stream = video.srcObject as MediaStream | null;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => track.stop());
      }

      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    });
  }, []);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    try {
      if (scanner?.isScanning) {
        await scanner.stop();
      }

      stopMediaTracks();
      scanner?.clear();
    } catch (err) {
      console.error('Stop scanner error:', err);
    } finally {
      stopMediaTracks();

      if (isMounted.current) {
        setCameraActive(false);
        setHasCameraPermission(false);
      }
    }
  }, [stopMediaTracks]);

  useEffect(() => {
    isMounted.current = true;
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
          async (decodedText) => {
            if (isHandlingScan.current) return;
            isHandlingScan.current = true;

            await stopScanner();
            await onScan(decodedText);
          },
          () => { } // Quietly ignore frame errors
        );

        if (isMounted.current) {
          setHasCameraPermission(true);
          setCameraActive(true);
        }
      } catch (err) {
        console.error('Scanner start error:', err);
        stopMediaTracks();

        if (isMounted.current) {
          setError('Camera access failed. Check browser permissions.');
          setHasCameraPermission(false);
          setCameraActive(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted.current = false;
      void stopScanner();
    };
  }, [onScan, stopMediaTracks, stopScanner]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const cameraStatus = cameraActive ? 'Camera active' : 'Camera off';

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-muted rounded-2xl overflow-hidden border-4 border-secondary shadow-2xl aspect-square">
        <div id="qr-reader" className="w-full h-full" />
        <div className="absolute top-3 right-3 z-50 rounded-full px-3 py-1 text-xs font-bold text-white/90 bg-black/50">
          {cameraStatus}
        </div>

        {(!hasCameraPermission && !error && cameraActive) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-6 text-center">
            <Camera className="w-12 h-12 mb-4 animate-pulse" />
            <p className="font-medium">Requesting Camera Access...</p>
          </div>
        )}

        {(!hasCameraPermission && !error && !cameraActive) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-6 text-center">
            <Camera className="w-12 h-12 mb-4" />
            <p className="font-medium">{cameraStatus}</p>
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
        onClick={handleClose}
        variant="ghost"
        className="mt-8 text-white hover:bg-white/10"
      >
        <X className="mr-2 h-4 w-4" /> Cancel
      </Button>
    </div >
  );
}
