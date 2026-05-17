import { roundMoney2 } from '@/app/lib/money';
import { formatMoney as formatUsdMoney } from '@/lib/money';

export function formatMoney(amount: number): string {
  return formatUsdMoney(roundMoney2(amount));
}

export function money(value: number) {
  return formatMoney(value);
}

export function discountLabel(discountRate: number) {
  if (discountRate <= 0) return 'No discount';
  return `${Math.round(discountRate * 100)}% off`;
}

export function saleDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-GB', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
