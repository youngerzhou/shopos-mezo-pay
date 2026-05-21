"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { roundMoney2 } from '@/app/lib/money';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle
} from '@/components/ui/sheet';
import type { CartItem } from '../types';
import { CheckoutItemList } from './CheckoutItemList';
import { CheckoutSettingList } from './CheckoutSettingList';
import { DISCOUNT_OPTIONS, POS_PAYMENT_METHODS, SALESPERSON_OPTIONS } from './checkout-options';
import { CouponBottomSheet } from './CouponBottomSheet';
import { DiscountBottomSheet } from './DiscountBottomSheet';
import { discountLabel, formatMoney, saleDateLabel } from './format';
import { MemberSummaryCard } from './MemberSummaryCard';
import { MusdQrPaymentSheet } from './MusdQrPaymentSheet';
import { PaymentMethodBottomSheet } from './PaymentMethodBottomSheet';
import { PointsRedeemBottomSheet } from './PointsRedeemBottomSheet';
import { RemarkBottomSheet } from './RemarkBottomSheet';
import { SalespersonBottomSheet } from './SalespersonBottomSheet';
import { SplitPaymentSheet } from './SplitPaymentSheet';
import type { CheckoutMember, CheckoutPayload, CouponOption, DiscountOption, PaymentMethodId, PaymentMode, SalespersonOption } from './types';

interface MobileCheckoutSheetProps {
  open: boolean;
  cartItems: CartItem[];
  member: CheckoutMember | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: CheckoutPayload) => void;
}

type ActiveSheet = 'discount' | 'coupon' | 'points' | 'salesperson' | 'payment' | 'splitPayment' | 'musdQrPayment' | 'remark' | null;

export function MobileCheckoutSheet({
  open,
  cartItems,
  member,
  loading,
  onOpenChange,
  onConfirm
}: MobileCheckoutSheetProps) {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [memberExpanded, setMemberExpanded] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountOption>(DISCOUNT_OPTIONS[0]);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponOption | null>(null);
  const [coupons, setCoupons] = useState<CouponOption[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [pointsDeduction, setPointsDeduction] = useState(0);
  const [salesperson, setSalesperson] = useState<SalespersonOption>(SALESPERSON_OPTIONS[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('cash');
  const [saleDate] = useState(() => new Date().toISOString());
  const [remark, setRemark] = useState('');

  const subtotal = useMemo(
    () => roundMoney2(cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0)),
    [cartItems]
  );
  const totalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );
  const memberMultiplier = member ? roundMoney2(1 - Number(member.discount_rate || 0)) : 1;
  const memberSubtotal = useMemo(
    () => roundMoney2(cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.qty * memberMultiplier, 0)),
    [cartItems, memberMultiplier]
  );
  const memberDiscountTotal = roundMoney2(Math.max(subtotal - memberSubtotal, 0));
  const afterOrderDiscount = roundMoney2(memberSubtotal * (1 - selectedDiscount.discountRate));
  const orderDiscount = roundMoney2(Math.max(memberSubtotal - afterOrderDiscount, 0));
  const validCoupon = selectedCoupon && member && afterOrderDiscount >= selectedCoupon.minSubtotal ? selectedCoupon : null;
  const couponDeduction = roundMoney2(Math.min(validCoupon?.amount || 0, afterOrderDiscount));
  const afterCoupon = roundMoney2(Math.max(afterOrderDiscount - couponDeduction, 0));
  const currentPoints = member ? Math.floor(Number(member.total_spent || 0) * 10) : 0;
  const maxPointsDeduction = roundMoney2(afterCoupon * 0.2);
  const maxCashFromPoints = roundMoney2(Math.floor(currentPoints / 100));
  const allowedPointsDeduction = member && currentPoints >= 100 ? roundMoney2(Math.min(maxCashFromPoints, maxPointsDeduction)) : 0;
  const appliedPointsDeduction = roundMoney2(Math.min(pointsDeduction, allowedPointsDeduction, afterCoupon));
  const pointsRedeemed = appliedPointsDeduction > 0 ? Math.floor(appliedPointsDeduction * 100) : 0;
  const finalTotal = roundMoney2(Math.max(afterCoupon - appliedPointsDeduction, 0));
  const availableCouponCount = member ? coupons.filter((coupon) => afterOrderDiscount >= coupon.minSubtotal).length : 0;

  useEffect(() => {
    if (!member?.walletAddress && !member?.referral_id) {
      setCoupons([]);
      setSelectedCoupon(null);
      return;
    }

    const controller = new AbortController();
    async function fetchCoupons() {
      setCouponsLoading(true);
      try {
        const params = new URLSearchParams({
          amount: String(afterOrderDiscount)
        });
        if (member?.walletAddress) params.set('wallet', String(member.walletAddress));
        if (member?.referral_id) params.set('referral_id', member.referral_id);
        const res = await fetch(`/api/customers/coupons?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load coupons');

        const nextCoupons = (data.coupons || []).map((coupon: any) => ({
          id: coupon.id,
          label: coupon.title,
          minSubtotal: Number(coupon.minimum_spend || 0),
          amount: Number(coupon.discount_amount || 0),
          type: coupon.coupon_type,
          expiresAt: coupon.expires_at
        }));
        setCoupons(nextCoupons);
        setSelectedCoupon((current) => current && nextCoupons.some((coupon: CouponOption) => coupon.id === current.id) ? current : null);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Failed to load coupons:', error);
          setCoupons([]);
          setSelectedCoupon(null);
        }
      } finally {
        setCouponsLoading(false);
      }
    }

    fetchCoupons();
    return () => controller.abort();
  }, [member?.walletAddress, member?.referral_id, afterOrderDiscount]);

  const couponLabel = !member
    ? 'Guest has no coupons'
    : availableCouponCount > 0
      ? (validCoupon?.label || 'Select coupon')
      : 'No coupons available';
  const pointsLabel = !member || allowedPointsDeduction <= 0
    ? 'Unavailable'
    : appliedPointsDeduction > 0
      ? `Redeemed ${formatMoney(appliedPointsDeduction)}`
      : 'Use points';

  const paymentMethodLabel = POS_PAYMENT_METHODS.find((method) => method.id === paymentMethod)?.label || 'Cash';
  const hasFastPayAllowance = Boolean(member?.walletAddress && Number(member?.musdAllowance || 0) >= finalTotal);

  const createCheckoutPayload = (
    paymentMode: PaymentMode,
    payments: CheckoutPayload['payments'],
    paymentDetails?: Record<string, unknown>
  ): CheckoutPayload => ({
    cartItems,
    member,
    subtotalUsd: subtotal,
    discountUsd: roundMoney2(memberDiscountTotal + orderDiscount),
    couponUsd: couponDeduction,
    pointsUsd: appliedPointsDeduction,
    finalUsd: finalTotal,
    finalSettlementMUSD: finalTotal,
    subtotal,
    memberDiscountTotal,
    orderDiscount,
    coupon: validCoupon,
    pointsRedeemed,
    pointsDeduction: appliedPointsDeduction,
    salespersonStaffId: salesperson.staffId,
    salespersonName: salesperson.name,
    saleDate,
    remark,
    paymentMethod: paymentMethodLabel,
    paymentMode,
    payments,
    paymentDetails,
    finalTotal
  });

  const openPaymentSheet = () => {
    setPaymentMethod(hasFastPayAllowance ? 'musdFastPay' : 'cash');
    setActiveSheet('payment');
  };

  const submitCheckout = (
    paymentMode: PaymentMode,
    payments: CheckoutPayload['payments']
  ) => {
    if (payments.some((payment) => payment.method === 'musd_fast_pay') && !member) {
      setActiveSheet('payment');
      return;
    }

    const checkoutPayload = createCheckoutPayload(paymentMode, payments);
    console.log('checkoutPayload', checkoutPayload);
    setActiveSheet(null);
    onConfirm(checkoutPayload);
  };

  const submitMusdFastPay = () => {
    const allowance = Number(member?.musdAllowance || 0);
    if (!member || !member.walletAddress || allowance < finalTotal) {
      console.warn('Insufficient MUSD allowance. Use Scan to Pay instead.');
      setActiveSheet('payment');
      return;
    }

    const paymentDetails = {
      method: 'musd_fast_pay',
      paymentFlow: 'pre_authorised',
      settlementToken: 'MUSD',
      amountUsd: finalTotal,
      amountMUSD: finalTotal,
      walletAddress: member.walletAddress,
      allowanceMUSD: allowance
    };
    const checkoutPayload = createCheckoutPayload('single', [{
      method: 'musd_fast_pay',
      amountUsd: finalTotal,
      amountMUSD: finalTotal,
      allowanceMUSD: allowance
    }], paymentDetails);
    console.log('checkoutPayload', checkoutPayload);
    setActiveSheet(null);
    onConfirm(checkoutPayload);
  };

  const submitMusdScanToPay = (intent: {
    paymentIntentId: string;
    orderId: string;
    amountUsd: number;
    amountMUSD: number;
    network: 'mezo-testnet';
    merchantWallet: string;
    payerWallet?: string;
    txHash?: string;
  }) => {
    const paymentDetails = {
      method: 'musd_scan_to_pay',
      paymentFlow: 'customer_scan_qr',
      settlementToken: 'MUSD',
      amountUsd: intent.amountUsd,
      amountMUSD: intent.amountMUSD,
      network: 'Mezo Testnet',
      merchantWallet: intent.merchantWallet,
      paymentIntentId: intent.paymentIntentId,
      orderId: intent.orderId,
      payerWallet: intent.payerWallet,
      txHash: intent.txHash,
      confirmationSource: 'goldsky_webhook'
    };
    const checkoutPayload = createCheckoutPayload('single', [{
      method: 'musd_scan_to_pay',
      amountUsd: intent.amountUsd,
      amountMUSD: intent.amountMUSD
    }], paymentDetails);
    console.log('checkoutPayload', checkoutPayload);
    setActiveSheet(null);
    onConfirm(checkoutPayload);
  };

  const confirmSinglePayment = () => {
    if (paymentMethod === 'musdFastPay') {
      submitMusdFastPay();
      return;
    }

    if (paymentMethod === 'musdScanToPay') {
      setActiveSheet('musdQrPayment');
      return;
    }

    submitCheckout('single', [{
      method: paymentMethod === 'storeCredit' ? 'store_credit' : paymentMethod === 'giftCard' ? 'gift_card' : paymentMethod === 'payLater' ? 'pay_later' : paymentMethod,
      amountUsd: finalTotal
    }]);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="left-1/2 h-[96vh] w-full max-w-[430px] -translate-x-1/2 overflow-hidden rounded-t-3xl border-0 bg-slate-100 p-0 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Checkout</SheetTitle>
          <SheetDescription className="sr-only">Mobile checkout confirmation</SheetDescription>
          <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 flex h-14 items-center justify-center bg-slate-100 px-4">
              <button type="button" className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full bg-white" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="h-5 w-5 text-slate-900" />
              </button>
              <h2 className="text-lg font-black text-slate-950">Checkout</h2>
            </header>

            <main className="flex-1 space-y-3 overflow-y-auto px-3 pb-28">
              <MemberSummaryCard
                member={member}
                expanded={memberExpanded}
                points={currentPoints}
                couponCount={availableCouponCount}
                onToggle={() => setMemberExpanded((current) => !current)}
              />

              <CheckoutItemList
                cartItems={cartItems}
                memberMultiplier={memberMultiplier}
                memberDiscountRate={Number(member?.discount_rate || 0)}
                finalBeforeExtraDiscount={memberSubtotal}
                totalQuantity={totalQuantity}
              />

              <CheckoutSettingList
                items={[
                  {
                    label: 'Order Discount',
                    value: discountLabel(selectedDiscount.discountRate),
                    onClick: () => setActiveSheet('discount')
                  },
                  {
                    label: 'Coupon',
                    value: couponLabel,
                    onClick: () => setActiveSheet('coupon')
                  },
                  {
                    label: 'Points Redemption',
                    value: pointsLabel,
                    disabled: !member,
                    onClick: () => setActiveSheet('points')
                  },
                  {
                    label: 'Salesperson',
                    value: salesperson.name,
                    onClick: () => setActiveSheet('salesperson')
                  },
                  {
                    label: 'Sale Date',
                    value: saleDateLabel(saleDate),
                    onClick: () => undefined
                  },
                  {
                    label: 'Remark',
                    value: remark || 'Add remark',
                    onClick: () => setActiveSheet('remark')
                  }
                ]}
              />

              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <SummaryRow label="Item Subtotal" value={memberSubtotal} />
                <SummaryRow label="Order Discount" value={-orderDiscount} />
                <SummaryRow label="Coupon" value={-couponDeduction} />
                <SummaryRow label="Points" value={-appliedPointsDeduction} />
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-black text-slate-950">Final Total</span>
                  <span className="text-xl font-black text-orange-700">{formatMoney(finalTotal)}</span>
                </div>
              </section>
            </main>

            <footer className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 items-center gap-3 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-500">Amount Due</p>
                <p className="truncate text-lg font-black text-slate-950">{formatMoney(finalTotal)}</p>
              </div>
              <Button
                className="h-12 rounded-xl bg-orange-600 px-4 text-sm font-black text-white hover:bg-red-950 xs:px-7 xs:text-base"
                disabled={loading || cartItems.length === 0}
                onClick={openPaymentSheet}
              >
                {loading ? 'Processing' : 'Confirm Payment'}
              </Button>
            </footer>
          </div>
        </SheetContent>
      </Sheet>

      <DiscountBottomSheet
        open={activeSheet === 'discount'}
        selectedId={selectedDiscount.id}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'discount' : null)}
        onSelect={setSelectedDiscount}
      />
      <CouponBottomSheet
        open={activeSheet === 'coupon'}
        hasMember={Boolean(member)}
        baseAmount={afterOrderDiscount}
        coupons={coupons}
        loading={couponsLoading}
        selectedCouponId={validCoupon?.id || null}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'coupon' : null)}
        onSelect={setSelectedCoupon}
      />
      <PointsRedeemBottomSheet
        open={activeSheet === 'points'}
        currentPoints={currentPoints}
        maxDeduction={maxPointsDeduction}
        value={appliedPointsDeduction}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'points' : null)}
        onConfirm={setPointsDeduction}
      />
      <SalespersonBottomSheet
        open={activeSheet === 'salesperson'}
        selectedStaffId={salesperson.staffId}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'salesperson' : null)}
        onSelect={setSalesperson}
      />
      <PaymentMethodBottomSheet
        open={activeSheet === 'payment'}
        amountDue={finalTotal}
        selectedMethod={paymentMethod}
        member={member}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'payment' : null)}
        onSelect={setPaymentMethod}
        onConfirmSingle={confirmSinglePayment}
        onOpenSplitPayment={() => setActiveSheet('splitPayment')}
      />
      <MusdQrPaymentSheet
        open={activeSheet === 'musdQrPayment'}
        amountDue={finalTotal}
        cartItems={cartItems}
        member={member}
        salesperson={salesperson}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'musdQrPayment' : 'payment')}
        onConfirmed={submitMusdScanToPay}
      />
      <SplitPaymentSheet
        open={activeSheet === 'splitPayment'}
        amountDue={finalTotal}
        hasMember={Boolean(member)}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'splitPayment' : null)}
        onConfirm={(payments) => submitCheckout('split', payments.map((payment) => ({
          method: payment.method === 'storeCredit' ? 'store_credit' : payment.method === 'giftCard' ? 'gift_card' : payment.method === 'payLater' ? 'pay_later' : payment.method === 'musdFastPay' ? 'musd_fast_pay' : payment.method === 'musdScanToPay' ? 'musd_scan_to_pay' : payment.method,
          amountUsd: payment.amount
        })))}
      />
      <RemarkBottomSheet
        open={activeSheet === 'remark'}
        value={remark}
        onOpenChange={(nextOpen) => setActiveSheet(nextOpen ? 'remark' : null)}
        onConfirm={setRemark}
      />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  const isNegative = value < 0;

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-bold text-slate-500">{label}</span>
      <span className={`font-black ${isNegative ? 'text-orange-700' : 'text-slate-950'}`}>
        {isNegative ? '-' : ''}{formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}
