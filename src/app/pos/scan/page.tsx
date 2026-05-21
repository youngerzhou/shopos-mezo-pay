"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Printer,
  RefreshCw,
  ReceiptText,
  Wallet
} from 'lucide-react';
import { CartBar } from '@/components/pos/CartBar';
import { CategorySidebar } from '@/components/pos/CategorySidebar';
import { MobileCheckoutSheet } from '@/components/pos/checkout/MobileCheckoutSheet';
import type { CheckoutPayload } from '@/components/pos/checkout/types';
import { mockCategories, mockProducts } from '@/components/pos/mock-data';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { TopHeader } from '@/components/pos/TopHeader';
import type { Product } from '@/components/pos/types';
import { ContractInteraction } from '@/components/ContractInteraction';
import { Scanner } from '@/components/Scanner';
import { StaffQRModal } from '@/components/StaffQRModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { getPassportLevel } from '@/app/lib/passport';
import { roundMoney2 } from '@/app/lib/money';
import { formatMoney } from '@/lib/money';
import { usePosCartStore } from '@/store/pos-cart';

interface PosOrderResult {
  order_id: string;
  order_no: string;
  total_amount: number;
  currency: string;
  payment_status?: string;
  payment_tx_hash?: string;
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
  walletAddress?: string | null;
  musdAllowance?: number;
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
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentTxHash, setPaymentTxHash] = useState('');
  const [receiptFallbackVisible, setReceiptFallbackVisible] = useState(false);
  const [posOrder, setPosOrder] = useState<PosOrderResult | null>(null);
  const [mezoOrder, setMezoOrder] = useState<MezoOrder | null>(null);
  const [merchantAddress, setMerchantAddress] = useState('0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7');
  const [staffId, setStaffId] = useState('STAFF001');
  const [staffName, setStaffName] = useState('Staff');
  const [showStaffQR, setShowStaffQR] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const cart = usePosCartStore((state) => state.items);
  const subtotal = usePosCartStore((state) => state.subtotal);
  const totalQuantity = usePosCartStore((state) => state.totalQuantity);
  const addItem = usePosCartStore((state) => state.addItem);
  const removeItem = usePosCartStore((state) => state.removeItem);
  const increaseQty = usePosCartStore((state) => state.increaseQty);
  const decreaseQty = usePosCartStore((state) => state.decreaseQty);
  const clearCart = usePosCartStore((state) => state.clearCart);

  const passportLevel = useMemo(() => {
    if (!walletAddress.trim()) return 0;
    return getPassportLevel(walletAddress);
  }, [walletAddress]);

  const discount = useMemo(
    () => roundMoney2(subtotal * Number(membership?.discount_rate || 0)),
    [subtotal, membership]
  );
  const total = useMemo(() => roundMoney2(subtotal - discount), [subtotal, discount]);
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    return mockProducts.filter((product) => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch = !query || [
        product.name,
        product.sku,
        product.barcode,
        product.brand,
        product.category
      ].some((value) => value?.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [productSearch, selectedCategory]);

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
    setReceiptFallbackVisible(false);
  };

  const addProduct = (product: Product) => {
    addItem(product);
    resetCheckoutState();
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
    setMembership({
      ...data,
      walletAddress: data.wallet_address || null,
      musdAllowance: data.fast_pay_enabled ? Number(data.fast_pay_allowance || 0) : 0
    });
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

  const removeCartItem = (productId: string) => {
    removeItem(productId);
    resetCheckoutState();
  };

  const increaseCartItem = (productId: string) => {
    increaseQty(productId);
    resetCheckoutState();
  };

  const decreaseCartItem = (productId: string) => {
    decreaseQty(productId);
    resetCheckoutState();
  };

  const clearCartItems = () => {
    clearCart();
    setIsCheckoutOpen(false);
    resetCheckoutState();
  };

  const openCheckoutConfirm = () => {
    if (isPaid || posOrder?.payment_status === 'paid') {
      console.log('[POSPaymentState] blocked payment prompt for paid order', {
        currentOrderId: posOrder?.order_id || null,
        currentPaymentIntentId: null,
        previousPaymentStatus: posOrder?.payment_status || 'paid',
        newPaymentStatus: 'paid',
        navigationTarget: 'receipt/print',
        receiptDataExists: cart.length > 0 && posOrder ? 'yes' : 'no'
      });
      setReceiptFallbackVisible(true);
      viewReceipt();
      return;
    }
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Cart Empty', description: 'Scan a product before checkout.' });
      return;
    }

    setIsCheckoutOpen(true);
  };

  const checkout = async (payload?: CheckoutPayload) => {
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Cart Empty', description: 'Scan a product before checkout.' });
      return;
    }

    setIsCheckoutOpen(false);
    setLoading(true);
    try {
      const paymentDetails = payload?.paymentDetails || {};
      const paymentMethod = String(paymentDetails.method || payload?.paymentMethod || '');
      const confirmedQrPayment = paymentMethod === 'musd_scan_to_pay' && Boolean(paymentDetails.txHash);
      const paymentIntentId = String(paymentDetails.paymentIntentId || paymentDetails.paymentRef || '');
      const paymentStatusBefore = posOrder?.payment_status || (isPaid ? 'paid' : posOrder ? 'ready' : 'none');
      console.log('[POSPaymentState] checkout started', {
        currentOrderId: posOrder?.order_id || null,
        currentOrderNo: posOrder?.order_no || null,
        paymentIntentId,
        paymentRef: paymentIntentId,
        previousPaymentStatus: paymentStatusBefore,
        incomingPaymentMethod: paymentMethod,
        incomingTxHash: paymentDetails.txHash || null,
        receiptDataExists: cart.length > 0 ? 'yes' : 'no'
      });

      const posRes = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: 'STORE_A',
          customer_referral_id: memberId,
          customer_wallet: walletAddress || null,
          coupon_id: payload?.coupon?.id || null,
          passport_level: passportLevel,
          currency: 'MUSD',
          items: cart.map((item) => ({ barcode: item.product.barcode, qty: item.qty }))
        })
      });
      const posData = await posRes.json();
      if (!posRes.ok) throw new Error(posData.error || 'Checkout failed');
      setPosOrder(posData);

      if (confirmedQrPayment) {
        const txHash = String(paymentDetails.txHash);
        console.log('[POSPaymentState] QR payment confirmed before POS finalization', {
          currentOrderId: posData.order_id,
          currentOrderNo: posData.order_no,
          paymentIntentId,
          paymentRef: paymentIntentId,
          previousPaymentStatus: paymentStatusBefore,
          newPaymentStatus: 'confirmed',
          txHash,
          navigationTarget: 'receipt/print',
          receiptDataExists: cart.length > 0 && posData ? 'yes' : 'no'
        });

        const posPaidRes = await fetch('/api/pos/orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: posData.order_id, tx_hash: txHash })
        });

        const posPaidData = await posPaidRes.json();
        if (!posPaidRes.ok) {
          setReceiptFallbackVisible(true);
          throw new Error(posPaidData.error || 'Payment confirmed, but POS order finalization failed.');
        }

        if (posPaidData.membership) setMembership(posPaidData.membership);
        setPaymentTxHash(txHash);
        setPosOrder({
          ...posData,
          payment_status: 'paid',
          payment_tx_hash: txHash
        });
        setMezoOrder(null);
        setIsPaid(true);
        setShowReceipt(true);
        setReceiptFallbackVisible(true);
        console.log('[POSPaymentState] navigated to receipt', {
          currentOrderId: posData.order_id,
          paymentIntentId,
          paymentRef: paymentIntentId,
          previousPaymentStatus: paymentStatusBefore,
          newPaymentStatus: 'paid',
          navigationTarget: 'receipt/print',
          receiptDataExists: cart.length > 0 && posData ? 'yes' : 'no',
          txHash
        });
        toast({ title: 'Payment Complete', description: `${posData.order_no} paid with MUSD Scan to Pay.` });
        return;
      }

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
      console.log('[POSPaymentState] order ready for customer payment', {
        currentOrderId: posData.order_id,
        currentOrderNo: posData.order_no,
        paymentIntentId,
        previousPaymentStatus: paymentStatusBefore,
        newPaymentStatus: 'ready',
        navigationTarget: 'payment',
        receiptDataExists: 'no'
      });
      toast({ title: 'Ready to Pay', description: `${posData.order_no} is ready for payment.` });
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
      console.log('[POSPaymentState] direct payment success received', {
        currentOrderId: posOrder?.order_id || null,
        currentPaymentIntentId: mezoOrder.id,
        paymentRef: mezoOrder.id,
        previousPaymentStatus: posOrder?.payment_status || 'payment_submitted',
        newPaymentStatus: 'confirmed',
        navigationTarget: 'receipt/print',
        receiptDataExists: cart.length > 0 && posOrder ? 'yes' : 'no',
        txHash
      });
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
      setReceiptFallbackVisible(true);
      console.log('[POSPaymentState] direct payment navigated to receipt', {
        currentOrderId: posOrder?.order_id || null,
        currentPaymentIntentId: mezoOrder.id,
        paymentRef: mezoOrder.id,
        previousPaymentStatus: posOrder?.payment_status || 'payment_submitted',
        newPaymentStatus: 'paid',
        navigationTarget: 'receipt/print',
        receiptDataExists: cart.length > 0 && posOrder ? 'yes' : 'no',
        txHash
      });
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
    clearCart();
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
    setIsCheckoutOpen(false);
    setReceiptFallbackVisible(false);
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

  if (isPaid || posOrder?.payment_status === 'paid') {
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
            {receiptFallbackVisible ? (
              <Button variant="outline" className="mt-3 h-11 w-full rounded-lg font-black" onClick={viewReceipt}>
                Open receipt / Print receipt
              </Button>
            ) : null}
          </div>

          {showReceipt && (
            <section id="receipt-preview" className="receipt-print mx-auto w-full max-w-[300px] bg-white p-4 font-mono text-[11px] leading-tight text-slate-950 shadow-xl sm:max-w-[320px]">
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
                  <span>USD</span>
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
    <div className="min-h-screen bg-orange-50 text-slate-950">
      <Toaster />
      <TopHeader
        scanInput={scanInput}
        loading={loading}
        isScanning={isScanning}
        staffName={staffName}
        memberLabel={membership ? `${membership.username || membership.referral_id} / ${membership.level_name}` : 'Guest'}
        walletLabel={walletAddress || 'Wallet not scanned'}
        onScanInputChange={setScanInput}
        onSubmitScan={() => handleUniversalScan(scanInput)}
        onOpenCamera={() => setIsScanning(true)}
        onShowStaffQR={() => setShowStaffQR(true)}
        onReset={resetAll}
      />

      <div className="mx-auto flex max-w-7xl">
        <CategorySidebar
          categories={mockCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <main className="min-w-0 flex-1">
          <ProductGrid
            products={filteredProducts}
            searchValue={productSearch}
            onSearchChange={setProductSearch}
            onAddProduct={(product) => {
              addProduct(product);
              toast({
                title: 'Product Added',
                description: `${product.name} ${product.size || ''}`.trim()
              });
            }}
          />

          {posOrder && posOrder.payment_status !== 'paid' && !isPaid && (
            <div className="mx-3 mb-32 rounded-lg border border-orange-200 bg-white p-3 text-sm font-bold text-orange-900 md:mx-5">
              {posOrder.order_no} ready. Total: {formatMoney(Number(posOrder.total_amount))}
            </div>
          )}

          {mezoOrder && (
            <Card className="mx-3 mb-32 rounded-lg border-orange-200 shadow-sm md:mx-5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-orange-700" />
                  Digital Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
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
      </div>

      {!mezoOrder && !isPaid && posOrder?.payment_status !== 'paid' && (
        <CartBar
          cart={cart}
          subtotal={subtotal}
          discount={discount}
          total={total}
          totalQuantity={totalQuantity}
          loading={loading}
          discountLabel={membership ? `${membership.level_name} pricing` : 'guest pricing'}
          onRemoveItem={removeCartItem}
          onIncreaseQty={increaseCartItem}
          onDecreaseQty={decreaseCartItem}
          onClearCart={clearCartItems}
          onCheckout={openCheckoutConfirm}
        />
      )}

      <MobileCheckoutSheet
        open={isCheckoutOpen}
        cartItems={cart}
        member={membership}
        loading={loading}
        onOpenChange={(nextOpen) => {
          if (isPaid || posOrder?.payment_status === 'paid') {
            console.log('[POSPaymentState] blocked checkout sheet reopen for paid order', {
              currentOrderId: posOrder?.order_id || null,
              previousPaymentStatus: posOrder?.payment_status || 'paid',
              newPaymentStatus: 'paid',
              navigationTarget: 'receipt/print',
              receiptDataExists: cart.length > 0 && posOrder ? 'yes' : 'no'
            });
            setReceiptFallbackVisible(true);
            return;
          }
          setIsCheckoutOpen(nextOpen);
        }}
        onConfirm={checkout}
      />

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
