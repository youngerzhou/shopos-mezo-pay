import type { CouponOption, DiscountOption, PaymentMethodId, SalespersonOption } from './types';

export const DISCOUNT_OPTIONS: DiscountOption[] = [
  { id: 'none', label: 'No discount', discountRate: 0 },
  { id: '10', label: '10% off', discountRate: 0.1 },
  { id: '20', label: '20% off', discountRate: 0.2 },
  { id: '25', label: '25% off', discountRate: 0.25 },
  { id: '33', label: '33% off', discountRate: 0.33 },
  { id: '50', label: '50% off', discountRate: 0.5 }
];

export const COUPON_OPTIONS: CouponOption[] = [
  { id: 'minus5', label: 'Spend 50 save 5', minSubtotal: 50, amount: 5 },
  { id: 'minus15', label: 'Spend 100 save 15', minSubtotal: 100, amount: 15 },
  { id: 'new3', label: 'New member instant 3 off', minSubtotal: 0, amount: 3 }
];

export const SALESPERSON_OPTIONS: SalespersonOption[] = [
  { staffId: 'STAFF001', name: 'Steven' },
  { staffId: 'STAFF002', name: 'London Store-01' },
  { staffId: 'STAFF003', name: 'Meimei Demo-02' },
  { staffId: 'STAFF004', name: 'Online Assistant-03' }
];

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
}

export const POS_PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'musdFastPay', label: 'MUSD Fast Pay' },
  { id: 'musdScanToPay', label: 'MUSD Scan to Pay' },
  { id: 'storeCredit', label: 'Store Credit' },
  { id: 'giftCard', label: 'Gift Card' },
  { id: 'payLater', label: 'Pay Later' }
];
