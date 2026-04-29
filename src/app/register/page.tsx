"use client";

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  UserPlus,
  Sparkles,
  CheckCircle2,
  Ticket,
  Smartphone,
  Mail,
  ArrowRight,
  UserCheck,
  Wallet,
  RefreshCw,
  Zap,
  ShieldCheck,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';

import {
  useWalletClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSignMessage,
  useSwitchChain,
  useChainId
} from 'wagmi';
import { ConnectKitButton, useModal } from 'connectkit';
import { parseUnits, maxUint256 } from 'viem';
import { mezoTestnet, MUSD_ADDRESSES, SHOPOS_PULL_PAYMENT_CONTRACT } from '@/app/lib/mezo-config';

const MUSD_ADDRESS = MUSD_ADDRESSES.testnet;
const ALLOWANCE_TIERS = [
  { amount: 100, label: '$100', discount: '5%' },
  { amount: 500, label: '$500', discount: '8%' },
  { amount: 1000, label: '$1000+', discount: '10%' },
] as const;

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const promoCode = searchParams?.get('promo');
  const staffPromoId = searchParams?.get('staff_promo');
  const { toast } = useToast();
  const { setOpen } = useModal();
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [staffName, setStaffName] = useState<string>('');
  const [formData, setFormData] = useState({
    username: '',
    contact: ''
  });
  const [newMember, setNewMember] = useState<any>(null);
  const [fastPayActive, setFastPayActive] = useState(false);
  const [selectedAllowance, setSelectedAllowance] = useState(100);
  const [pendingAllowanceAmount, setPendingAllowanceAmount] = useState<number | null>(null);
  const [lastRequestedAllowanceAmount, setLastRequestedAllowanceAmount] = useState<number | null>(null);
  const [authorizedAllowanceAmount, setAuthorizedAllowanceAmount] = useState<number | null>(null);
  const [walletGuidance, setWalletGuidance] = useState<string>('');
  const [hasAutoSignatureRequested, setHasAutoSignatureRequested] = useState(false);

  const { address, isConnected, isConnecting, status } = useAccount();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const { data: walletClient, isLoading: isWalletClientLoading } = useWalletClient();

  const {
    writeContractAsync,
    data: approveHash,
    isPending: isApproving,
  } = useWriteContract();
  const { signMessage, isPending: isSigningMessage } = useSignMessage();

  const {
    isLoading: isConfirmingApprove,
    isSuccess: isApproveConfirmed
  } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const isWalletSessionReady =
    mounted &&
    status === 'connected' &&
    isConnected &&
    !!address &&
    !!walletClient &&
    !isWalletClientLoading;

  const requestAllowanceApproval = useCallback(async (amount: number) => {
    if (!isWalletSessionReady || chainId !== mezoTestnet.id) {
      return;
    }

    try {
      const amountUnits = amount === -1 ? maxUint256 : parseUnits(amount.toString(), 18);
      setLastRequestedAllowanceAmount(amount);

      toast({
        title: "Opening Wallet...",
        description: "Please confirm the allowance approval in your wallet app.",
      });

      await writeContractAsync({
        address: MUSD_ADDRESS as `0x${string}`,
        abi: [
          {
            name: 'approve',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'approve',
        args: [SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`, amountUnits],
      });
    } catch (err: any) {
      setLastRequestedAllowanceAmount(null);
      toast({ variant: "destructive", title: "Approval Error", description: err.message });
    }
  }, [chainId, isWalletSessionReady, toast, writeContractAsync]);

  // Resume the pending approval only after the wallet session is fully hydrated.
  useEffect(() => {
    if (pendingAllowanceAmount === null || !isWalletSessionReady || chainId !== mezoTestnet.id) {
      return;
    }

    const amount = pendingAllowanceAmount;
    setPendingAllowanceAmount(null);
    void requestAllowanceApproval(amount);
  }, [chainId, isWalletSessionReady, pendingAllowanceAmount, requestAllowanceApproval]);

  useEffect(() => {
    if (isApproveConfirmed) {
      setFastPayActive(true);
      if (lastRequestedAllowanceAmount !== null) {
        setAuthorizedAllowanceAmount(lastRequestedAllowanceAmount);
      }
      setLastRequestedAllowanceAmount(null);
      toast({
        title: "Fast Pay Authorized!",
        description: "Your allowance tier and bonus discount are now active.",
      });
    }
  }, [isApproveConfirmed, lastRequestedAllowanceAmount, toast]);

  useEffect(() => {
    // If wallet connection was not completed, do not keep the UI locked.
    if (status === 'disconnected') {
      setPendingAllowanceAmount(null);
      setLastRequestedAllowanceAmount(null);
      setHasAutoSignatureRequested(false);
      setWalletGuidance('Wallet disconnected. Tap "Connect Wallet (Mobile Link)" and approve the connection in MetaMask.');
    }
  }, [status]);

  useEffect(() => {
    // Trigger one identity signature immediately after wallet connection.
    if (!mounted || !isConnected || !address || hasAutoSignatureRequested || isSigningMessage) {
      return;
    }

    setHasAutoSignatureRequested(true);
    signMessage(
      { message: 'Welcome to Mezo Pay! Please sign this to verify your identity.' },
      {
        onSuccess: () => {
          setWalletGuidance('Signature verified. Redirecting...');
          if (promoCode) {
            window.location.href = `/customer/membership-card?staffId=${promoCode}`;
          } else {
            window.location.href = '/dashboard';
          }
        },
        onError: () => {
          // Allow one-click retry by reconnecting or refreshing state.
          setHasAutoSignatureRequested(false);
          setWalletGuidance('Signature was not completed. Re-open the wallet prompt and sign to continue.');
        },
      }
    );
  }, [address, hasAutoSignatureRequested, isConnected, isSigningMessage, mounted, promoCode, signMessage]);

  const handleEnableFastPay = useCallback(async (amount: number) => {
    if (!mounted) {
      setPendingAllowanceAmount(amount);
      setWalletGuidance('Preparing wallet module... please wait a moment and tap authorize again.');
      return;
    }

    if (!isConnected) {
      setPendingAllowanceAmount(amount);
      setWalletGuidance('No wallet connected. Tap "Connect Wallet (Mobile Link)" and confirm in MetaMask.');
      setOpen(true);
      return;
    }

    if (!isWalletSessionReady) {
      setPendingAllowanceAmount(amount);
      setWalletGuidance('Wallet app opened, but session is not ready yet. Complete connection in MetaMask and return here.');
      setOpen(true);
      toast({
        title: "Waiting for Wallet Session",
        description: "Complete the wallet connection in MetaMask, then the approval request will open automatically.",
      });
      return;
    }

    if (chainId !== mezoTestnet.id) {
      setWalletGuidance('Wrong network detected. Please approve network switch to Mezo Testnet in your wallet.');
      toast({
        title: "Switching Network",
        description: "Please switch to Mezo Testnet in your wallet.",
      });
      setPendingAllowanceAmount(amount);
      switchChain({ chainId: mezoTestnet.id });
      return;
    }

    setWalletGuidance('Approval request sent. Check MetaMask for the transaction confirmation prompt.');
    await requestAllowanceApproval(amount);
  }, [chainId, isConnected, isWalletSessionReady, mounted, requestAllowanceApproval, setOpen, switchChain, toast]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.contact) {
      toast({ variant: "destructive", title: "Wait!", description: "Please fill in all fields." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username.trim(),
          contact: formData.contact.trim(),
          staff_id: staffPromoId
        })
      });

      const data = await res.json();
      if (res.ok && data && data.referral_id) {
        setNewMember(data);
        setStep('success');
        toast({ title: "Welcome!", description: "Your member profile is ready." });
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const authorizedTier = ALLOWANCE_TIERS.find((tier) => tier.amount === authorizedAllowanceAmount);
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const isWrongNetwork = mounted && isConnected && chainId !== mezoTestnet.id;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 max-w-md mx-auto relative overflow-hidden">
      <Toaster />

      <header className="py-12 flex flex-col items-center gap-4 text-center z-10">
        <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
          <UserPlus className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-primary">ShopOS Mezo</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">Customer Onboarding</p>
        </div>
      </header>

      <main className="flex-1 z-10">
        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Welcome!</h2>
                  <p className="text-sm font-medium text-slate-500">Join the Mezo ecosystem today.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Name</label>
                    <Input
                      placeholder="e.g. Satoshi"
                      className="h-14 rounded-2xl pl-6 border-slate-200 focus:ring-primary/20"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Info</label>
                    <Input
                      placeholder="e.g. +1 234 567 890"
                      className="h-14 rounded-2xl pl-6 border-slate-200 focus:ring-primary/20"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 gap-2 mt-4">
                    {loading ? 'Registering...' : 'Claim My Member Card'}
                    <Sparkles className="w-5 h-5 fill-white" />
                  </Button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 w-full"
            >
              <div className="w-full bg-slate-900 rounded-[3rem] text-white shadow-2xl overflow-hidden relative border border-white/5 p-8 text-center flex flex-col gap-6">
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight leading-none">Active Member</h2>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Mezo Network Loyalty</p>
                </div>

                <div className="bg-white p-6 rounded-3xl inline-block mx-auto">
                  <QRCodeCanvas value={newMember?.referral_id || ''} size={150} level="H" />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Member Identifier</p>
                  <p className="text-2xl font-black tracking-tighter text-white">{newMember?.referral_id}</p>
                </div>
              </div>

              <div className="space-y-4">
                {mounted && !isConnected && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-amber-900 uppercase mb-1">No Wallet Detected</p>
                      <p className="text-[10px] text-amber-800 opacity-80">Open this page inside your Crypto Wallet browser to unlock bonus discounts.</p>
                    </div>
                  </div>
                )}

                {!mounted ? (
                  <div className="h-12 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                ) : isConnected && address ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      Wallet Connected
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-900">
                      Wallet Connected: <span className="font-mono">{shortAddress}</span>
                    </p>
                  </div>
                ) : (
                  <ConnectKitButton.Custom>
                    {({ show }) => (
                      <Button onClick={show} variant="outline" className="w-full h-12 rounded-xl border-dashed border-primary/30 text-primary font-bold text-xs">
                        Connect Wallet (Mobile Link)
                      </Button>
                    )}
                  </ConnectKitButton.Custom>
                )}

                {isWrongNetwork && (
                  <Button
                    variant="destructive"
                    className="w-full h-12 rounded-xl font-black text-xs"
                    onClick={() => switchChain({ chainId: mezoTestnet.id })}
                  >
                    Switch to Mezo Testnet
                  </Button>
                )}

                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Allowance Tiers</p>
                    <p className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-1 rounded-md">Bonus Discount</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {ALLOWANCE_TIERS.map((tier) => (
                      <button
                        key={tier.amount}
                        className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${selectedAllowance === tier.amount
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 bg-white text-slate-400'
                          }`}
                        onClick={() => setSelectedAllowance(tier.amount)}
                        disabled={fastPayActive}
                      >
                        <p className="text-sm font-black">{tier.label}</p>
                        <p className="text-[8px] font-black uppercase opacity-60">{tier.discount} Off</p>
                      </button>
                    ))}
                  </div>

                  <Button
                    variant={fastPayActive ? "default" : "outline"}
                    disabled={!mounted || isApproving || isConfirmingApprove || fastPayActive || isConnecting || isWalletClientLoading}
                    className={`w-full h-16 rounded-2xl font-black gap-3 transition-all ${fastPayActive ? 'bg-emerald-500 border-none' : 'border-primary/20 text-primary'}`}
                    onClick={() => handleEnableFastPay(selectedAllowance)}
                  >
                    {!mounted || isApproving || isConfirmingApprove || isConnecting || isWalletClientLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : fastPayActive ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                    {fastPayActive ? 'Fast Pay Enabled' : (!mounted ? 'Loading Wallet...' : (isConnecting || isWalletClientLoading ? 'Checking Wallet...' : (isApproving || isConfirmingApprove ? 'Authorizing...' : `Authorize Tiered Allowance`)))}
                  </Button>

                  {!fastPayActive && walletGuidance && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                        Wallet Guidance
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-800">
                        {walletGuidance}
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-blue-700/90">
                        If no wallet popup appears, open this page directly inside the MetaMask in-app browser and try again.
                      </p>
                    </div>
                  )}

                  {fastPayActive && authorizedTier && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        Authorized Tier
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-900">
                        {authorizedTier.label} Allowance
                      </p>
                      <p className="text-xs font-semibold text-emerald-700">
                        Bonus Discount Active: {authorizedTier.discount} OFF
                      </p>
                    </div>
                  )}
                </div>

                <Button variant="outline" className="w-full h-16 rounded-2xl font-black gap-2 text-primary border-primary/20 bg-primary/5" onClick={() => window.location.href = '/'}>
                  Start Shopping
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 text-center mt-auto">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Mezo Network Secured</p>
      </footer>
    </div>
  );
}
