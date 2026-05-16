"use client";

import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeCanvas } from 'qrcode.react';

interface StaffQRModalProps {
    staffId: string;
    staffName?: string;
    isOpen: boolean;
    onClose: () => void;
}

export function StaffQRModal({ staffId, staffName, isOpen, onClose }: StaffQRModalProps) {
    const [qrValue, setQrValue] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && staffId) {
            // Generate registration URL with staff_promo parameter
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            const registrationUrl = `${baseUrl}/register?staff_promo=${staffId}`;
            setQrValue(registrationUrl);
        }
    }, [isOpen, staffId]);

    if (!isOpen || !mounted) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Staff QR Code</p>
                            <p className="font-bold text-slate-900">{staffName || staffId}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-center">
                        <div className="bg-white p-4 rounded-lg border-2 border-slate-100">
                            {qrValue && (
                                <QRCodeCanvas
                                    value={qrValue}
                                    size={256}
                                    level="H"
                                    includeMargin={true}
                                    fgColor="#000000"
                                    bgColor="#ffffff"
                                />
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                        <p className="font-medium mb-1">How it works:</p>
                        <p>Customers can scan this QR code to open member self-registration and link to <span className="font-bold">{staffName || staffId}</span>.</p>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
