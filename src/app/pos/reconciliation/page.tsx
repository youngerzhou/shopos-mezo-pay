"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PaymentSummaryRow = {
  key: string;
  paymentMethod: string;
  orderCount: number;
  amount: number;
  blockchain: boolean;
};

type BlockchainTransaction = {
  orderId: string;
  orderNo: string;
  paymentIntentId: string;
  txHash: string;
  walletAddress: string;
  blockNumber: number | null;
  amount: number;
  status: string;
  paymentFlow: string;
  createdAt: string;
  explorerUrl: string | null;
};

type ReconciliationReport = {
  storeName: string;
  from: string;
  to: string;
  paymentSummary: PaymentSummaryRow[];
  blockchainSummary: {
    totalBlockchainPayments: number;
    musdWalletPaymentTotal: number;
    musdFastPayTotal: number;
    blockchainSettlementTotal: number;
    onChainConfirmedOrders: number;
    pendingBlockchainConfirmation: number;
    failedExpiredBlockchainPayments: number;
  };
  orderStatusSummary: {
    paidOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
  };
  membershipSummary: {
    memberOrders: number;
    nonMemberOrders: number;
    couponsUsed: number;
    couponDiscountTotal: number;
    fastPayRewardCouponsIssued: number;
    newMembersRegisteredToday: number;
  };
  totals: {
    totalOrders: number;
    grossSalesAmount: number;
    discountAmount: number;
    refundAmount: number;
    netPaidAmount: number;
    blockchainPaymentTotal: number;
    musdPaymentCount: number;
  };
  blockchainTransactions: BlockchainTransaction[];
  printedAt: string;
};

type QuickFilter = 'today' | 'yesterday' | 'day-before-yesterday' | 'custom';

const emptyReport: ReconciliationReport = {
  storeName: 'Mezo',
  from: '',
  to: '',
  paymentSummary: [],
  blockchainSummary: {
    totalBlockchainPayments: 0,
    musdWalletPaymentTotal: 0,
    musdFastPayTotal: 0,
    blockchainSettlementTotal: 0,
    onChainConfirmedOrders: 0,
    pendingBlockchainConfirmation: 0,
    failedExpiredBlockchainPayments: 0
  },
  orderStatusSummary: {
    paidOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    refundedOrders: 0
  },
  membershipSummary: {
    memberOrders: 0,
    nonMemberOrders: 0,
    couponsUsed: 0,
    couponDiscountTotal: 0,
    fastPayRewardCouponsIssued: 0,
    newMembersRegisteredToday: 0
  },
  totals: {
    totalOrders: 0,
    grossSalesAmount: 0,
    discountAmount: 0,
    refundAmount: 0,
    netPaidAmount: 0,
    blockchainPaymentTotal: 0,
    musdPaymentCount: 0
  },
  blockchainTransactions: [],
  printedAt: ''
};

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function rangeForFilter(filter: QuickFilter) {
  const date = new Date();
  if (filter === 'yesterday') date.setDate(date.getDate() - 1);
  if (filter === 'day-before-yesterday') date.setDate(date.getDate() - 2);
  return { from: startOfDay(date), to: endOfDay(date) };
}

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatRange(from: string, to: string) {
  if (!from || !to) return '-';
  return `${formatDateTime(from).slice(0, 16)} → ${formatDateTime(to).slice(0, 16)}`;
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} MUSD`;
}

function shortHash(value: string) {
  if (!value) return '-';
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

export default function DailyReconciliationReportPage() {
  const todayRange = useMemo(() => rangeForFilter('today'), []);
  const [filter, setFilter] = useState<QuickFilter>('today');
  const [customFrom, setCustomFrom] = useState(toDateInputValue(todayRange.from));
  const [customTo, setCustomTo] = useState(toDateInputValue(todayRange.to));
  const [report, setReport] = useState<ReconciliationReport>(emptyReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const selectedRange = useMemo(() => {
    if (filter !== 'custom') return rangeForFilter(filter);
    return {
      from: startOfDay(new Date(`${customFrom}T00:00:00`)),
      to: endOfDay(new Date(`${customTo}T00:00:00`))
    };
  }, [customFrom, customTo, filter]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        from: selectedRange.from.toISOString(),
        to: selectedRange.to.toISOString()
      });
      const res = await fetch(`/api/pos/reconciliation?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load reconciliation report');
      setReport(data);
    } catch (err: any) {
      setReport({
        ...emptyReport,
        from: selectedRange.from.toISOString(),
        to: selectedRange.to.toISOString(),
        printedAt: new Date().toISOString()
      });
      setError(err.message || 'Unable to load reconciliation report');
    } finally {
      setLoading(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const blockchainRows = report.paymentSummary.filter((row) => row.blockchain);

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 print:bg-white print:p-0">
      <section className="no-print mx-auto mb-4 flex max-w-5xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-orange-700">ShopOS Mezo Pay</p>
          <h1 className="text-xl font-black">Daily Reconciliation Report</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuickButton active={filter === 'today'} onClick={() => setFilter('today')}>Today</QuickButton>
          <QuickButton active={filter === 'yesterday'} onClick={() => setFilter('yesterday')}>Yesterday</QuickButton>
          <QuickButton active={filter === 'day-before-yesterday'} onClick={() => setFilter('day-before-yesterday')}>Day Before Yesterday</QuickButton>
          <QuickButton active={filter === 'custom'} onClick={() => setFilter('custom')}>Custom Range</QuickButton>
          <Button variant="outline" className="h-9 rounded-md" onClick={loadReport} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </Button>
          <Button className="h-9 rounded-md bg-orange-600 font-black text-white hover:bg-red-950" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>
      </section>

      {filter === 'custom' ? (
        <section className="no-print mx-auto mb-4 grid max-w-5xl grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-950"
            />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-950"
            />
          </label>
          <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
            <CalendarDays className="h-4 w-4 text-orange-700" />
            Auto reload enabled
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="no-print mx-auto mb-4 max-w-5xl rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <article id="daily-reconciliation-report" className="reconciliation-print mx-auto max-w-5xl bg-white p-4 shadow-sm print:mx-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Daily Reconciliation Report</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">Store Name: {report.storeName || 'Mezo'}</p>
            </div>
            <div className="text-left text-xs font-bold text-slate-600 sm:text-right">
              <p>Business Date Range</p>
              <p className="text-sm text-slate-950">{formatRange(report.from, report.to)}</p>
            </div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Total Orders" value={report.totals.totalOrders.toString()} />
          <Kpi label="Net Paid Amount" value={money(report.totals.netPaidAmount)} strong />
          <Kpi label="Blockchain Total" value={money(report.totals.blockchainPaymentTotal)} blockchain />
          <Kpi label="MUSD Payment Count" value={report.totals.musdPaymentCount.toString()} blockchain />
        </section>

        <ReportSection title="1. Payment Summary">
          <Table>
            <thead>
              <tr>
                <Th>Payment Method</Th>
                <Th align="right">Order Count</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {report.paymentSummary.map((row) => (
                <tr key={row.key} className={row.blockchain ? 'bg-orange-50 print:bg-white' : ''}>
                  <Td>
                    <span className="font-black">{row.paymentMethod}</span>
                    {row.blockchain ? <span className="ml-2 rounded-full border border-orange-300 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700">Blockchain</span> : null}
                  </Td>
                  <Td align="right">{row.orderCount}</Td>
                  <Td align="right">{money(row.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ReportSection>

        <ReportSection title="2. Blockchain Settlement Summary">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Total Blockchain Payments" value={money(report.blockchainSummary.totalBlockchainPayments)} blockchain />
            <Metric label="MUSD Wallet Payment Total" value={money(report.blockchainSummary.musdWalletPaymentTotal)} blockchain />
            <Metric label="MUSD Fast Pay Total" value={money(report.blockchainSummary.musdFastPayTotal)} blockchain />
            <Metric label="Blockchain Settlement Total" value={money(report.blockchainSummary.blockchainSettlementTotal)} blockchain />
            <Metric label="On-chain Confirmed Orders" value={report.blockchainSummary.onChainConfirmedOrders.toString()} />
            <Metric label="Pending Blockchain Confirmation" value={report.blockchainSummary.pendingBlockchainConfirmation.toString()} />
            <Metric label="Failed / Expired Blockchain Payments" value={report.blockchainSummary.failedExpiredBlockchainPayments.toString()} />
          </div>
        </ReportSection>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportSection title="3. Order Status Summary">
            <CompactList rows={[
              ['Paid Orders', report.orderStatusSummary.paidOrders],
              ['Pending Orders', report.orderStatusSummary.pendingOrders],
              ['Cancelled Orders', report.orderStatusSummary.cancelledOrders],
              ['Refunded Orders', report.orderStatusSummary.refundedOrders]
            ]} />
          </ReportSection>

          <ReportSection title="4. Membership & Promotion Summary">
            <CompactList rows={[
              ['Member Orders', report.membershipSummary.memberOrders],
              ['Non-member Orders', report.membershipSummary.nonMemberOrders],
              ['Coupons Used', report.membershipSummary.couponsUsed],
              ['Coupon Discount Total', money(report.membershipSummary.couponDiscountTotal)],
              ['Fast Pay Reward Coupons Issued', report.membershipSummary.fastPayRewardCouponsIssued],
              ['New Members Registered Today', report.membershipSummary.newMembersRegisteredToday]
            ]} />
          </ReportSection>
        </div>

        <ReportSection title="5. Sales Totals">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Total Orders" value={report.totals.totalOrders.toString()} />
            <Metric label="Gross Sales Amount" value={money(report.totals.grossSalesAmount)} />
            <Metric label="Discount Amount" value={money(report.totals.discountAmount)} />
            <Metric label="Refund Amount" value={money(report.totals.refundAmount)} />
            <Metric label="Net Paid Amount" value={money(report.totals.netPaidAmount)} strong />
            <Metric label="Blockchain Payment Total" value={money(report.totals.blockchainPaymentTotal)} blockchain />
            <Metric label="MUSD Payment Count" value={report.totals.musdPaymentCount.toString()} blockchain />
          </div>
        </ReportSection>

        <ReportSection title="6. Blockchain Transaction References">
          {report.blockchainTransactions.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-500">
              No blockchain transaction references for this range.
            </div>
          ) : (
            <div className="space-y-2">
              {report.blockchainTransactions.map((tx, index) => {
                const key = tx.txHash || tx.paymentIntentId || `${tx.orderId}-${index}`;
                const open = expandedTx === key;
                return (
                  <div key={key} className="rounded-md border border-slate-300">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold text-slate-700"
                      onClick={() => setExpandedTx(open ? null : key)}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-950">{tx.orderNo || tx.orderId || 'Blockchain Payment'}</span>
                        <span className="block break-all text-slate-500">{shortHash(tx.txHash || tx.paymentIntentId)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase">{tx.status}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {open ? (
                      <div className="grid gap-2 border-t border-slate-200 p-3 text-xs font-bold text-slate-600 sm:grid-cols-2">
                        <DebugLine label="paymentIntentId" value={tx.paymentIntentId || '-'} />
                        <DebugLine label="txHash" value={tx.txHash || '-'} />
                        <DebugLine label="walletAddress" value={tx.walletAddress || '-'} />
                        <DebugLine label="blockNumber" value={tx.blockNumber == null ? '-' : tx.blockNumber.toString()} />
                        <DebugLine label="amount" value={money(tx.amount)} />
                        <DebugLine label="paymentFlow" value={tx.paymentFlow || '-'} />
                        <DebugLine label="createdAt" value={formatDateTime(tx.createdAt)} />
                        <div>
                          <p className="text-slate-400">Explorer</p>
                          {tx.explorerUrl ? <a className="break-all text-orange-700 underline" href={tx.explorerUrl} target="_blank" rel="noreferrer">View on Explorer</a> : <p>-</p>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </ReportSection>

        <ReportSection title="7. Signature Area">
          <div className="grid grid-cols-1 gap-8 pt-4 sm:grid-cols-2">
            <SignatureLine label="Cashier Signature" />
            <SignatureLine label="Manager Signature" />
          </div>
        </ReportSection>

        <footer className="mt-5 border-t border-slate-300 pt-3 text-xs font-bold text-slate-600">
          Printed At: {formatDateTime(report.printedAt || new Date().toISOString())}
        </footer>
      </article>
    </main>
  );
}

function QuickButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md border px-3 text-xs font-black ${active ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-2 border-b border-slate-300 pb-1 text-sm font-black uppercase tracking-wide text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function Kpi({ label, value, strong, blockchain }: { label: string; value: string; strong?: boolean; blockchain?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${blockchain ? 'border-orange-300 bg-orange-50 print:bg-white' : 'border-slate-300 bg-slate-50 print:bg-white'}`}>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg ${strong ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value, strong, blockchain }: { label: string; value: string; strong?: boolean; blockchain?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${blockchain ? 'border-orange-300 bg-orange-50 print:bg-white' : 'border-slate-300 bg-white'}`}>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-base ${strong ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse text-sm">{children}</table>;
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`border border-slate-300 bg-slate-100 px-2 py-2 text-xs font-black uppercase tracking-wide text-slate-600 print:bg-white ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td className={`border border-slate-300 px-2 py-2 font-bold text-slate-800 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</td>;
}

function CompactList({ rows }: { rows: [string, string | number][] }) {
  return (
    <div className="divide-y divide-slate-200 rounded-md border border-slate-300">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
          <span className="font-bold text-slate-500">{label}</span>
          <span className="text-right font-black text-slate-950">{value}</span>
        </div>
      ))}
    </div>
  );
}

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="break-all text-slate-800">{value}</p>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-10 border-b border-slate-900" />
      <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-600">{label}</p>
    </div>
  );
}
