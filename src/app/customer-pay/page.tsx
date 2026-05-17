"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Wallet } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { useModal } from 'connectkit';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { mezoTestnet } from '@/app/lib/mezo-config';
import { formatMUSD, formatMoney } from '@/lib/money';

const erc20Abi = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

const shoposPaymentAbi = [
  {
    name: 'payOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'paymentIntentId', type: 'bytes32' },
      { name: 'orderId', type: 'bytes32' },
      { name: 'merchant', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  }
] as const;

type Step = 'idle' | 'approving' | 'paying' | 'submitted' | 'confirmed';

function shortAddress(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function CustomerPayContent() {
  const params = useSearchParams();
  const publicClient = usePublicClient();
  const { address, isConnected, chainId } = useAccount();
  const { isPending: isConnecting } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { setOpen: setConnectModalOpen } = useModal();

  const [decimals, setDecimals] = useState(18);
  const [allowance, setAllowance] = useState(0);
  const [balance, setBalance] = useState(0);
  const [rawAllowance, setRawAllowance] = useState<bigint | null>(null);
  const [rawBalance, setRawBalance] = useState<bigint | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState('');
  const [loadingBalances, setLoadingBalances] = useState(false);

  const paymentIntentId = params.get('paymentIntentId') || '';
  const orderId = params.get('orderId') || '';
  const paymentIntentIdBytes32 = params.get('paymentIntentIdBytes32') || '';
  const orderIdBytes32 = params.get('orderIdBytes32') || '';
  const merchant = params.get('merchant') || process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET || '';
  const amount = Number(params.get('amount') || 0);
  const network = params.get('network') || 'mezo-testnet';
  const musdAddress = process.env.NEXT_PUBLIC_MUSD_ADDRESS || '';
  const paymentContract = process.env.NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT || '';
  const merchantEnv = process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET || '';
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || '';

  const amountInUnits = useMemo(() => {
    try {
      return parseUnits(amount.toFixed(2), decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash
  });

  const missingEnv = [
    !musdAddress ? 'NEXT_PUBLIC_MUSD_ADDRESS' : '',
    !paymentContract ? 'NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT' : '',
    !merchantEnv ? 'NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET' : '',
    !rpcUrl ? 'NEXT_PUBLIC_SEPOLIA_RPC_URL' : ''
  ].filter(Boolean);
  const hasRequiredParams = Boolean(paymentIntentId && orderId && paymentIntentIdBytes32 && orderIdBytes32 && merchant && amount > 0);
  const isWrongNetwork = isConnected && chainId !== mezoTestnet.id;
  const hasEnoughAllowance = allowance >= amount;
  const hasEnoughBalance = balance >= amount;

  const loadTokenState = useCallback(async () => {
    if (!publicClient || !address || !musdAddress || !paymentContract) return;
    setLoadingBalances(true);
    setError('');

    try {
      const tokenDecimals = await publicClient.readContract({
        address: musdAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals'
      });
      setDecimals(Number(tokenDecimals));

      const [rawAllowance, rawBalance] = await Promise.all([
        publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, paymentContract as `0x${string}`]
        }),
        publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address]
        })
      ]);

      setRawAllowance(rawAllowance);
      setRawBalance(rawBalance);
      setAllowance(Number(formatUnits(rawAllowance, Number(tokenDecimals))));
      setBalance(Number(formatUnits(rawBalance, Number(tokenDecimals))));
    } catch (err: any) {
      setError(err.message || 'Unable to read MUSD allowance.');
    } finally {
      setLoadingBalances(false);
    }
  }, [address, musdAddress, paymentContract, publicClient]);

  useEffect(() => {
    if (isConnected && !isWrongNetwork) {
      loadTokenState();
    }
  }, [isConnected, isWrongNetwork, loadTokenState]);

  useEffect(() => {
    if (isConfirmed && (step === 'paying' || step === 'submitted')) {
      setStep('confirmed');
    }
    if (isConfirmed && step === 'approving') {
      setStep('idle');
      loadTokenState();
    }
  }, [isConfirmed, loadTokenState, step]);

  const connectWallet = () => {
    // Use ConnectKit modal to show wallet selector (same as register page)
    setConnectModalOpen(true);
  };

  const switchToMezo = async () => {
    setError('');
    try {
      await switchChain({ chainId: mezoTestnet.id });
    } catch (err: any) {
      setError(err.message || 'Please switch to Mezo Testnet.');
    }
  };

  const approveMusd = async () => {
    setError('');
    if (missingEnv.length > 0) {
      setError(`Missing environment configuration: ${missingEnv.join(', ')}.`);
      return;
    }
    if (!hasEnoughBalance) {
      setError('Insufficient MUSD balance.');
      return;
    }

    try {
      setStep('approving');
      const hash = await writeContractAsync({
        address: musdAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [paymentContract as `0x${string}`, amountInUnits]
      });
      setTxHash(hash);
    } catch (err: any) {
      setStep('idle');
      setError(err.message?.toLowerCase().includes('rejected') ? 'Transaction cancelled.' : err.message || 'Approve transaction failed.');
    }
  };

  const payOrder = async () => {
    setError('');
    if (missingEnv.length > 0) {
      setError(`Missing environment configuration: ${missingEnv.join(', ')}.`);
      return;
    }
    if (!hasEnoughBalance) {
      setError('Insufficient MUSD balance.');
      return;
    }

    try {
      setStep('paying');
      const hash = await writeContractAsync({
        address: paymentContract as `0x${string}`,
        abi: shoposPaymentAbi,
        functionName: 'payOrder',
        args: [
          paymentIntentIdBytes32 as `0x${string}`,
          orderIdBytes32 as `0x${string}`,
          merchant as `0x${string}`,
          amountInUnits
        ]
      });
      setTxHash(hash);
      setStep('submitted');
    } catch (err: any) {
      setStep('idle');
      setError(err.message?.toLowerCase().includes('rejected') ? 'Transaction cancelled.' : err.message || 'Payment transaction failed.');
    }
  };

  const primaryAction = () => {
    if (!isConnected) return connectWallet();
    if (isWrongNetwork) return switchToMezo();
    if (!hasEnoughBalance) return undefined;
    if (!hasEnoughAllowance) return approveMusd();
    return payOrder();
  };

  const primaryLabel = !isConnected
    ? 'Connect Wallet'
    : isWrongNetwork
      ? 'Switch to Mezo Testnet'
      : !hasEnoughBalance
        ? 'Insufficient MUSD balance'
        : !hasEnoughAllowance
          ? 'Approve MUSD'
          : 'Pay MUSD';

  const disablePrimary = isConnecting ||
    loadingBalances ||
    step === 'approving' ||
    step === 'paying' ||
    isConfirming ||
    step === 'submitted' ||
    step === 'confirmed' ||
    !hasRequiredParams ||
    (isConnected && !isWrongNetwork && !hasEnoughBalance);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950">
      <section className="mx-auto max-w-[430px] space-y-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-orange-700">SHOPOS Payment</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Pay with MUSD</h1>
          <div className="mt-5 space-y-2 rounded-2xl bg-orange-50 p-4">
            <InfoRow label="Amount Due" value={formatMoney(amount || 0)} />
            <InfoRow label="Pay" value={formatMUSD(amount || 0)} />
            <InfoRow label="Merchant wallet" value={merchant ? shortAddress(merchant) : '-'} />
            <InfoRow label="Payment Ref" value={paymentIntentId || '-'} />
            <InfoRow label="Network" value={network === 'mezo-testnet' ? 'Mezo Testnet' : network} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          {missingEnv.length > 0 ? (
            <StatusBox tone="error" text={`Missing environment configuration: ${missingEnv.join(', ')}.`} />
          ) : !hasRequiredParams ? (
            <StatusBox tone="error" text="Invalid payment link. Missing payment intent details." />
          ) : (
            <>
              {isConnected ? (
                <div className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold">
                  <p className="text-slate-500">Customer wallet</p>
                  <p className="mt-1 break-all text-slate-950">{address}</p>
                </div>
              ) : null}

              {isConnected && !isWrongNetwork ? (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <Metric label="MUSD Balance" value={loadingBalances ? 'Loading...' : formatMUSD(balance)} />
                  <Metric label="Allowance" value={loadingBalances ? 'Loading...' : formatMUSD(allowance)} />
                </div>
              ) : null}

              {isWrongNetwork ? <StatusBox tone="warn" text="Please switch to Mezo Testnet." /> : null}
              {!isWrongNetwork && isConnected && !hasEnoughBalance ? <StatusBox tone="error" text="Insufficient MUSD balance." /> : null}

              <Button
                className="mt-4 h-12 w-full rounded-xl bg-orange-600 text-base font-black text-white hover:bg-red-950"
                disabled={disablePrimary}
                onClick={primaryAction}
              >
                {isConnecting || loadingBalances || step === 'approving' || step === 'paying' || isConfirming ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="mr-2 h-4 w-4" />
                )}
                {primaryLabel}
              </Button>
            </>
          )}
        </div>

        {txHash ? (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-950">Transaction</p>
            <p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{txHash}</p>
            {step === 'submitted' || isConfirming ? <StatusBox tone="warn" text="Waiting for blockchain confirmation..." /> : null}
            {step === 'confirmed' ? <StatusBox tone="success" text="Payment Submitted" /> : null}
            <p className="mt-3 text-xs font-bold text-slate-500">
              The POS will be confirmed automatically by the Goldsky webhook after the OrderPaid event is indexed.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">Diagnostics</p>
          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
            <DebugRow label="connected wallet address" value={address || '-'} />
            <DebugRow label="current chainId" value={chainId?.toString() || '-'} />
            <DebugRow label="expected chainId" value="31611" />
            <DebugRow label="MUSD contract address" value={musdAddress || '-'} />
            <DebugRow label="ShopOSPayment contract address" value={paymentContract || '-'} />
            <DebugRow label="merchant wallet" value={merchant || '-'} />
            <DebugRow label="amountInUnits" value={amountInUnits.toString()} />
            <DebugRow label="MUSD decimals" value={decimals.toString()} />
            <DebugRow label="MUSD balance raw" value={rawBalance?.toString() || '-'} />
            <DebugRow label="MUSD allowance raw" value={rawAllowance?.toString() || '-'} />
            <DebugRow label="parsed balance" value={balance.toString()} />
            <DebugRow label="parsed allowance" value={allowance.toString()} />
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm font-bold">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-slate-950">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="break-all text-slate-700">{value}</span>
    </div>
  );
}

function StatusBox({ tone, text }: { tone: 'success' | 'warn' | 'error'; text: string }) {
  const classes = {
    success: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-orange-50 text-orange-700',
    error: 'bg-red-50 text-red-700'
  };

  return (
    <div className={`mt-4 rounded-2xl p-3 text-sm font-bold ${classes[tone]}`}>
      {tone === 'success' ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertCircle className="mr-2 inline h-4 w-4" />}
      {text}
    </div>
  );
}

export default function CustomerPayPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-100 p-6 text-center font-bold">Loading payment...</main>}>
      <CustomerPayContent />
    </Suspense>
  );
}
