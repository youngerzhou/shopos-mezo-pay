"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BadgePercent,
  CheckCircle2,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ReceiptText,
  ScanLine,
  Settings,
  ShoppingBag,
  Trash2,
  UserCheck,
  User,
  Wallet
} from 'lucide-react';
import { ContractInteraction } from '@/components/ContractInteraction';
import { Scanner } from '@/components/Scanner';
import { StaffQRModal } from '@/components/StaffQRModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { getPassportLevel } from '@/app/lib/passport';
import { roundMoney2 } from '@/app/lib/money';

interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  color?: string;
  size?: string;
  price: number;
  currency: string;
  stock_qty: number;
  image_url?: string;
}

interface CartItem {
  product: Product;
  qty: number;
}

interface PosOrderResult {
  order_id: string;
  order_no: string;
  total_amount: number;
  currency: string;
  created_at?: string;
  member_level_code?: string | null;
  member_level_name?: string | null;
  member_discount_rate?: number;
}

interface MezoOrder {
  id: string;
  amount_musd: number;
  transaction_hash?: string;
  fast_pay_triggered?: boolean;
}

interface Membership {
  referral_id: string;
  username: string | null;
  wallet_address?: string | null;
  wallet_address_display?: string | null;
  total_spent: number;
  level: number;
  level_code: string;
  level_name: string;
  discount_rate: number;
  min_spend_amount: number;
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function extractMemberId(value: string) {
  const trimmed = value.trim();
  const direct = trimmed.match(/^MEM_[A-Z0-9_-]+$/i);
  if (direct) return direct[0].toUpperCase();

  try {
    const url = new URL(trimmed);
    const referralId = url.searchParams.get('referral_id') || url.searchParams.get('member') || url.searchParams.get('customerId');
    if (referralId?.startsWith('MEM_')) return referralId.toUpperCase();
  } catch {
    // Plain barcode input, not a URL.
  }

  const embedded = trimmed.match(/MEM_[A-Z0-9_-]+/i);
  return embedded ? embedded[0].toUpperCase() : null;
}

function shortValue(value?: string | null) {
  if (!value) return '-';
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatMoney(value: number) {
  return Number(value || 0).toFixed(2);
}

function formatReceiptDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || '-';

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

export default function ShoposHome() {
  const { toast } = useToast();
  const [scanInput, setScanInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentTxHash, setPaymentTxHash] = useState('');
  const [posOrder, setPosOrder] = useState<PosOrderResult | null>(null);
  const [mezoOrder, setMezoOrder] = useState<MezoOrder | null>(null);
  const [merchantAddress, setMerchantAddress] = useState('0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7');
  const [staffId, setStaffId] = useState('STAFF001');
  const [staffName, setStaffName] = useState('Staff');
  const [showStaffQR, setShowStaffQR] = useState(false);

  const passportLevel = useMemo(() => {
    if (!walletAddress.trim()) return 0;
    return getPassportLevel(walletAddress);
  }, [walletAddress]);

  const subtotal = useMemo(
    () => roundMoney2(cart.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0)),
    [cart]
  );
  const discount = useMemo(
    () => roundMoney2(subtotal * Number(membership?.discount_rate || 0)),
    [subtotal, membership]
  );
  const total = useMemo(() => roundMoney2(subtotal - discount), [subtotal, discount]);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (data.Merchant_Wallet_Address) setMerchantAddress(data.Merchant_Wallet_Address);
      } catch (error) {
        console.error('Failed to fetch merchant settings:', error);
      }
    }

    async function fetchStaffInfo() {
      try {
        // Get staff information (default to STAFF001)
        // In a real app, you'd fetch this from an API based on logged-in staff
        const res = await fetch(`/api/admin/staff?staff_id=STAFF001`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setStaffName(data.username || 'STAFF001');
        } else {
          setStaffName('STAFF001');
        }
      } catch (error) {
        console.error('Failed to fetch staff info:', error);
        setStaffName('STAFF001');
      }
    }

    fetchSettings();
    fetchStaffInfo();
  }, []);

  const resetCheckoutState = () => {
    setPosOrder(null);
    setMezoOrder(null);
    setIsPaid(false);
    setShowReceipt(false);
    setPaymentTxHash('');
  };

  const addProduct = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: Math.min(item.qty + 1, Number(product.stock_qty)) }
            : item
        );
      }
      return [...current, { product, qty: 1 }];
    });
  };

  const lookupProduct = useCallback(async (barcode: string) => {
    const res = await fetch(`/api/products/by-barcode?barcode=${encodeURIComponent(barcode)}`, { cache: 'no-store' });
    const product = await res.json();
    if (!res.ok) throw new Error(product.error || 'Product not found');
    addProduct(product);
    toast({
      title: 'Product Added',
      description: `${product.name} ${product.color || ''} ${product.size || ''}`.trim()
    });
  }, [toast]);

  const lookupMembership = useCallback(async (referralId: string) => {
    const res = await fetch(`/api/customers/membership?referral_id=${encodeURIComponent(referralId)}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Member not found');

    setMemberId(data.referral_id);
    setMembership(data);
    if (data.wallet_address && WALLET_RE.test(data.wallet_address)) {
      setWalletAddress(data.wallet_address.toLowerCase());
    }
    toast({
      title: 'Member Card Recognized',
      description: data.wallet_address_display
        ? `${data.level_name} member discount applied. Wallet ${data.wallet_address_display} ready for Fast Pay.`
        : `${data.level_name} member discount applied.`
    });
  }, [toast]);

  const handleUniversalScan = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;

    setIsScanning(false);
    setLoading(true);
    resetCheckoutState();

    try {
      const foundMemberId = extractMemberId(value);
      if (foundMemberId) {
        await lookupMembership(foundMemberId);
        return;
      }

      if (WALLET_RE.test(value)) {
        const normalizedWallet = value.toLowerCase();
        setWalletAddress(normalizedWallet);
        const level = getPassportLevel(normalizedWallet);
        toast({
          title: 'Payment Wallet Recognized',
          description: `Passport Lv.${level} detected for checkout.`
        });
        return;
      }

      await lookupProduct(value);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Scan Not Recognized',
        description: error.message
      });
    } finally {
      setScanInput('');
      setIsScanning(false);
      setLoading(false);
    }
  }, [lookupMembership, lookupProduct, toast]);

  const updateQty = (productId: string, nextQty: number) => {
    setCart((current) =>
      current
        .map((item) => item.product.id === productId ? { ...item, qty: nextQty } : item)
        .filter((item) => item.qty > 0)
    );
    resetCheckoutState();
  };

  const checkout = async () => {
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Cart Empty', description: 'Scan a product before checkout.' });
      return;
    }

    setLoading(true);
    try {
      const posRes = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: 'STORE_A',
          customer_referral_id: memberId,
          customer_wallet: walletAddress || null,
          passport_level: passportLevel,
          currency: 'MUSD',
          items: cart.map((item) => ({ barcode: item.product.barcode, qty: item.qty }))
        })
      });
      const posData = await posRes.json();
      if (!posRes.ok) throw new Error(posData.error || 'Checkout failed');
      setPosOrder(posData);

      const mezoRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: memberId,
          walletAddress: walletAddress || undefined,
          amount: posData.total_amount
        })
      });
      const mezoData = await mezoRes.json();
      if (!mezoRes.ok) throw new Error(mezoData.error || 'Payment flow failed');

      if (mezoData.fast_pay_triggered) {
        if (!mezoData.transaction_hash) {
          throw new Error('Fast Pay completed without a transaction hash.');
        }

        setPaymentTxHash(mezoData.transaction_hash);
        const posPaidRes = await fetch('/api/pos/orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: posData.order_id, tx_hash: mezoData.transaction_hash })
        });

        if (!posPaidRes.ok) {
          throw new Error('Payment succeeded on-chain, but POS order finalization failed.');
        }

        const posPaidData = await posPaidRes.json();
        if (posPaidData.membership) setMembership(posPaidData.membership);

        setIsPaid(true);
        setShowReceipt(true);
        toast({ title: 'Fast Pay Complete', description: `${posData.order_no} paid with existing Mezo flow.` });
        return;
      }

      setMezoOrder(mezoData);
      toast({ title: 'Ready to Pay', description: `${posData.order_no} is ready for MUSD payment.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Checkout Failed',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (txHash: string) => {
    if (!mezoOrder) return;

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: mezoOrder.id, status: 'paid', txHash })
      });

      if (!res.ok) throw new Error('Payment succeeded, but order status update failed.');

      if (posOrder?.order_id) {
        const posRes = await fetch('/api/pos/orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: posOrder.order_id, tx_hash: txHash })
        });

        if (!posRes.ok) {
          const data = await posRes.json();
          throw new Error(data.error || 'POS membership update failed.');
        }

        const posData = await posRes.json();
        if (posData.membership) setMembership(posData.membership);
      }

      setIsPaid(true);
      setShowReceipt(true);
      setPaymentTxHash(txHash);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setCart([]);
    setMemberId(null);
    setMembership(null);
    setWalletAddress('');
    setScanInput('');
    setIsScanning(false);
    setLoading(false);
    setPosOrder(null);
    setMezoOrder(null);
    setIsPaid(false);
    setShowReceipt(false);
    setPaymentTxHash('');
  };

  const viewReceipt = () => {
    setShowReceipt(true);
    window.setTimeout(() => {
      document.getElementById('receipt-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const receiptItems = cart.map((item) => {
    const lineSubtotal = roundMoney2(Number(item.product.price) * item.qty);
    const lineDiscount = roundMoney2(lineSubtotal * Number(membership?.discount_rate || 0));
    const lineTotal = roundMoney2(lineSubtotal - lineDiscount);

    return {
      ...item,
      unitPrice: roundMoney2(Number(item.product.price)),
      lineTotal
    };
  });

  if (isPaid) {
    return (
      <div className="pos-receipt-screen min-h-screen bg-slate-100 px-4 py-6 text-slate-950">
        <Toaster />
        <div className="mx-auto max-w-md space-y-4">
          <div className="no-print rounded-lg border border-emerald-200 bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Payment Received</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">{posOrder?.order_no || 'POS Order'} Paid</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Receipt Preview is ready for screen display.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button className="h-11 rounded-lg font-black" onClick={viewReceipt}>
                <ReceiptText className="mr-2 h-4 w-4" />
                View Receipt
              </Button>
              <Button variant="outline" className="h-11 rounded-lg font-black" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </Button>
              <Button variant="secondary" className="h-11 rounded-lg font-black" onClick={resetAll}>
                <RefreshCw className="mr-2 h-4 w-4" />
                New Sale
              </Button>
            </div>
          </div>

          {showReceipt && (
            <section id="receipt-preview" className="receipt-print mx-auto max-w-[320px] bg-white p-4 font-mono text-[11px] leading-tight text-slate-950 shadow-xl">
              <div className="text-center">
                <p className="text-base font-black tracking-wide">SHOPOS Mezo</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest">Receipt Preview</p>
              </div>

              <div className="my-3 border-t border-dashed border-slate-400" />

              <div className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span>ORDER</span>
                  <span className="text-right">{posOrder?.order_no || '-'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>DATE</span>
                  <span className="text-right">{formatReceiptDate(posOrder?.created_at)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>CUSTOMER</span>
                  <span className="text-right">{membership?.username || 'Guest'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>REFERRAL</span>
                  <span className="text-right">{membership?.referral_id || memberId || '-'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>LEVEL</span>
                  <span className="text-right">{membership?.level_name || posOrder?.member_level_name || 'Guest'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>WALLET</span>
                  <span className="text-right">{shortValue(walletAddress)}</span>
                </div>
              </div>

              <div className="my-3 border-t border-dashed border-slate-400" />

              <div className="space-y-3">
                {receiptItems.map((item) => (
                  <div key={item.product.id}>
                    <div className="flex justify-between gap-2 font-black">
                      <span className="max-w-[190px] break-words">{item.product.name}</span>
                      <span>{formatMoney(item.lineTotal)}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-slate-600">
                      <span>{item.product.color || '-'} / {item.product.size || '-'}</span>
                      <span>{item.qty} x {formatMoney(item.unitPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-dashed border-slate-400" />

              <div className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span>SUBTOTAL</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>MEMBER DISCOUNT</span>
                  <span>-{formatMoney(discount)}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm font-black">
                  <span>TOTAL PAID</span>
                  <span>{formatMoney(posOrder?.total_amount || total)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>CURRENCY</span>
                  <span>{posOrder?.currency || 'MUSD'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>TX HASH</span>
                  <span>{shortValue(paymentTxHash || mezoOrder?.transaction_hash)}</span>
                </div>
              </div>

              <div className="my-3 border-t border-dashed border-slate-400" />

              <p className="text-center font-black">Thank you for shopping with SHOPOS Mezo.</p>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Toaster />
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">
        <header className="sticky top-0 z-30 border-b bg-white/90 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">SHOPOS Mezo</p>
              <h1 className="text-2xl font-black tracking-tight">Scan & Checkout</h1>
            </div>
            <div className="flex gap-1 items-center">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg gap-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setShowStaffQR(true)}
                title="Show staff QR code"
              >
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-xs font-bold">{staffName}</span>
              </Button>
              <Link href="/admin/settings">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={resetAll}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-4 p-4 pb-32">
          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanLine className="h-5 w-5 text-emerald-600" />
                Universal Scan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={scanInput}
                  onChange={(event) => setScanInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleUniversalScan(scanInput);
                  }}
                  placeholder="Barcode, member QR, or wallet address"
                  className="h-12 rounded-lg"
                />
                <Button className="h-12 rounded-lg px-4" disabled={loading} onClick={() => handleUniversalScan(scanInput)}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                className="h-12 w-full rounded-lg border-dashed font-black"
                onClick={() => setIsScanning(true)}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Scan with Camera
              </Button>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <span>Camera status</span>
                <span className={isScanning ? 'text-emerald-700' : 'text-slate-400'}>
                  {isScanning ? 'Camera active' : 'Camera off'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400">Demo barcodes: SHOPOS100, SHOPOS500, SHOPOS1000</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                <UserCheck className="h-4 w-4" />
                Member
              </div>
              <p className="truncate text-sm font-black">{membership?.username || 'Guest'}</p>
              <p className="truncate text-[10px] font-bold text-slate-400">
                {membership
                  ? `${membership.referral_id} - ${membership.level_name} - ${(Number(membership.discount_rate || 0) * 100).toFixed(0)}% off - ${membership.total_spent.toFixed(2)} MUSD spent`
                  : 'No member card'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                <Wallet className="h-4 w-4" />
                Wallet
              </div>
              <p className="truncate text-sm font-black">{walletAddress || 'Not scanned'}</p>
            </div>
          </div>

          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingBag className="h-5 w-5 text-slate-700" />
                  Basket
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-800">
                  {membership ? `${membership.level_name} Member` : 'Guest Pricing'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-medium text-slate-400">
                  Scan or type a product barcode to add clothing items.
                </div>
              ) : (
                cart.map((item) => {
                  const lineSubtotal = roundMoney2(Number(item.product.price) * item.qty);
                  const lineDiscount = roundMoney2(lineSubtotal * Number(membership?.discount_rate || 0));
                  const lineTotal = roundMoney2(lineSubtotal - lineDiscount);

                  return (
                    <div key={item.product.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-200">
                          {item.product.image_url ? (
                            <img src={item.product.image_url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">{item.product.name}</p>
                              <p className="text-xs font-medium text-slate-500">
                                {item.product.color || '-'} / {item.product.size || '-'}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-slate-400"
                              onClick={() => updateQty(item.product.id, 0)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => updateQty(item.product.id, item.qty - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-black">{item.qty}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => updateQty(item.product.id, Math.min(item.qty + 1, Number(item.product.stock_qty)))}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">{Number(item.product.price).toFixed(2)} MUSD each</p>
                              <p className="text-sm font-black">{lineTotal.toFixed(2)} MUSD</p>
                              {lineDiscount > 0 && (
                                <p className="text-[10px] font-bold text-emerald-700">-{lineDiscount.toFixed(2)} member discount</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-500">Subtotal</span>
                <span className="font-black">{subtotal.toFixed(2)} MUSD</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-500">
                  <BadgePercent className="h-4 w-4 text-emerald-600" />
                  Member Discount
                </span>
                <span className="font-black text-emerald-700">-{discount.toFixed(2)} MUSD</span>
              </div>
              <div className="flex items-end justify-between border-t pt-3">
                <span className="font-black">Total</span>
                <span className="text-3xl font-black tracking-tight">{total.toFixed(2)} MUSD</span>
              </div>
            </CardContent>
          </Card>

          {posOrder && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
              {posOrder.order_no} ready. Total: {Number(posOrder.total_amount).toFixed(2)} {posOrder.currency}
            </div>
          )}

          {mezoOrder && (
            <Card className="rounded-lg border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2 text-sm font-black">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Mezo MUSD Payment
                </div>
                <ContractInteraction
                  orderId={mezoOrder.id}
                  amount={Number(mezoOrder.amount_musd)}
                  merchantAddress={merchantAddress}
                  onSuccess={handlePaymentSuccess}
                  onError={(error) => toast({
                    variant: 'destructive',
                    title: 'Payment Failed',
                    description: error
                  })}
                />
              </CardContent>
            </Card>
          )}
        </main>

        {!mezoOrder && (
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t bg-white p-4 shadow-2xl">
            <Button
              className="h-14 w-full rounded-lg bg-slate-950 text-base font-black text-white"
              disabled={loading || cart.length === 0}
              onClick={checkout}
            >
              {loading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Wallet className="mr-2 h-5 w-5" />}
              Checkout
            </Button>
          </div>
        )}
      </div>

      {isScanning && (
        <Scanner
          onScan={handleUniversalScan}
          onClose={() => setIsScanning(false)}
        />
      )}

      <StaffQRModal
        staffId={staffId}
        staffName={staffName}
        isOpen={showStaffQR}
        onClose={() => setShowStaffQR(false)}
      />
    </div>
  );
}
