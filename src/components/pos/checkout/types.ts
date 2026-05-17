import type { CartItem } from '../types';

export type PaymentMethodId =
  | 'cash'
  | 'card'
  | 'storeCredit'
  | 'musdFastPay'
  | 'musdScanToPay'
  | 'giftCard'
  | 'payLater';

export type PaymentMode = 'single' | 'split';

export interface CheckoutMember {
  referral_id: string;
  username: string | null;
  total_spent: number;
  level_name: string;
  discount_rate: number;
  walletAddress?: string | null;
  musdAllowance?: number;
}

export interface DiscountOption {
  id: string;
  label: string;
  discountRate: number;
}

export interface CouponOption {
  id: string;
  label: string;
  minSubtotal: number;
  amount: number;
}

export interface SalespersonOption {
  staffId: string;
  name: string;
}

export interface CheckoutPayload {
  cartItems: CartItem[];
  member: CheckoutMember | null;
  subtotalUsd: number;
  discountUsd: number;
  couponUsd: number;
  pointsUsd: number;
  finalUsd: number;
  finalSettlementMUSD: number;
  subtotal: number;
  memberDiscountTotal: number;
  orderDiscount: number;
  coupon: CouponOption | null;
  pointsRedeemed: number;
  pointsDeduction: number;
  salespersonStaffId: string;
  salespersonName: string;
  saleDate: string;
  remark: string;
  paymentMethod: string;
  paymentMode: PaymentMode;
  payments: {
    method: string;
    amountUsd: number;
    amountMUSD?: number;
    allowanceMUSD?: number;
  }[];
  paymentDetails?: Record<string, unknown>;
  finalTotal: number;
}
