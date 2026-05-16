"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Contract, BrowserProvider, MaxUint256, formatUnits } from 'ethers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Info, ShieldCheck, AlertTriangle, Wallet } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { MUSD_ADDRESSES, SHOPOS_PULL_PAYMENT_CONTRACT } from '@/app/lib/mezo-config';

const MUSD_ADDRESS = MUSD_ADDRESSES.testnet;
const ERC20_ALLOWANCE_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

type AllowanceState = {
    raw: bigint;
    formatted: string;
    decimals: number;
};

function shortAddress(address?: string | null) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';
}

function getEthereumProvider() {
    return (window as Window & { ethereum?: unknown }).ethereum;
}

function MembershipCardContent() {
    const searchParams = useSearchParams();
    const referralId = searchParams?.get('referral_id') || searchParams?.get('referralId');
    const [member, setMember] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [allowance, setAllowance] = useState<AllowanceState | null>(null);
    const [allowanceLoading, setAllowanceLoading] = useState(false);
    const [allowanceError, setAllowanceError] = useState<string | null>(null);
    const [approveLoading, setApproveLoading] = useState(false);
    const [approveHash, setApproveHash] = useState<string | null>(null);

    const walletMatchesMember =
        !!walletAddress &&
        !!member?.wallet_address &&
        walletAddress.toLowerCase() === String(member.wallet_address).toLowerCase();
    const allowanceAuthorized = !!allowance && allowance.raw > 0n;
    const dbAuthorized = !!(member?.fast_pay_authorized ?? member?.fast_pay_enabled);
    const staleAuthorization = dbAuthorized && !!allowance && allowance.raw === 0n;

    const refreshMember = async () => {
        if (!referralId) return null;

        const res = await fetch(`/api/customers/verify?referral_id=${encodeURIComponent(referralId)}`);
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || 'Member not found.');
        }
        setMember(data);
        return data;
    };

    const getTokenContract = async (withSigner = false) => {
        const ethereum = getEthereumProvider();
        if (!ethereum) {
            throw new Error('Wallet provider not found.');
        }

        const provider = new BrowserProvider(ethereum);
        const runner = withSigner ? await provider.getSigner() : provider;
        return new Contract(MUSD_ADDRESS, ERC20_ALLOWANCE_ABI, runner);
    };

    const checkAllowance = async (customerAddress?: string) => {
        const targetAddress = customerAddress || member?.wallet_address || walletAddress;
        if (!targetAddress) {
            setAllowance(null);
            setAllowanceError('Member wallet address is missing.');
            return null;
        }

        setAllowanceLoading(true);
        setAllowanceError(null);

        try {
            const token = await getTokenContract(false);
            const decimals = Number(await token.decimals());
            const allowanceBefore = await token.allowance(targetAddress, SHOPOS_PULL_PAYMENT_CONTRACT) as bigint;
            const formatted = formatUnits(allowanceBefore, decimals);

            console.log('[Fast Pay Reauth] allowance check', {
                customerAddress: targetAddress,
                spender: SHOPOS_PULL_PAYMENT_CONTRACT,
                allowanceBefore: allowanceBefore.toString(),
                allowanceFormatted: formatted,
                tokenDecimals: decimals,
            });

            const nextAllowance = { raw: allowanceBefore, formatted, decimals };
            setAllowance(nextAllowance);
            return nextAllowance;
        } catch (err: any) {
            console.error('[Fast Pay Reauth] allowance check failed', err);
            setAllowanceError(err?.message || 'Unable to read Fast Pay allowance.');
            return null;
        } finally {
            setAllowanceLoading(false);
        }
    };

    const connectWallet = async () => {
        try {
            const ethereum = getEthereumProvider();
            if (!ethereum) {
                setAllowanceError('MetaMask or another EVM wallet is required.');
                return;
            }

            const provider = new BrowserProvider(ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            const connected = accounts?.[0] || null;
            setWalletAddress(connected);
            if (connected) {
                await checkAllowance(member?.wallet_address || connected);
            }
        } catch (err: any) {
            console.error('[Fast Pay Reauth] wallet connection failed', err);
            setAllowanceError(err?.message || 'Unable to connect wallet.');
        }
    };

    const syncFastPay = async (txHash?: string) => {
        if (!referralId) return null;

        const res = await fetch('/api/customers/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                referral_id: referralId,
                action: 'sync_fast_pay',
                tx_hash: txHash,
            }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || 'Unable to sync Fast Pay status.');
        }
        setMember(data.customer);
        return data.customer;
    };

    const reauthorizeFastPay = async () => {
        if (!walletAddress || !walletMatchesMember) {
            setAllowanceError('Connect the member wallet before re-authorizing Fast Pay.');
            return;
        }

        setApproveLoading(true);
        setAllowanceError(null);

        try {
            const before = await checkAllowance(member.wallet_address);
            const token = await getTokenContract(true);
            const decimals = before?.decimals ?? Number(await token.decimals());

            const tx = await token.approve(SHOPOS_PULL_PAYMENT_CONTRACT, MaxUint256);
            setApproveHash(tx.hash);

            console.log('[Fast Pay Reauth] approve submitted', {
                customerAddress: walletAddress,
                spender: SHOPOS_PULL_PAYMENT_CONTRACT,
                approveTxHash: tx.hash,
                allowanceBefore: before?.raw.toString(),
                tokenDecimals: decimals,
            });

            await tx.wait();
            const after = await checkAllowance(member.wallet_address);

            console.log('[Fast Pay Reauth] approve confirmed', {
                customerAddress: walletAddress,
                spender: SHOPOS_PULL_PAYMENT_CONTRACT,
                approveTxHash: tx.hash,
                allowanceBefore: before?.raw.toString(),
                allowanceAfter: after?.raw.toString(),
                tokenDecimals: after?.decimals ?? decimals,
            });

            await syncFastPay(tx.hash);
            await refreshMember();
        } catch (err: any) {
            console.error('[Fast Pay Reauth] approve failed', err);
            setAllowanceError(err?.shortMessage || err?.message || 'Fast Pay re-authorization failed.');
        } finally {
            setApproveLoading(false);
        }
    };

    useEffect(() => {
        if (!referralId) {
            setError('Referral ID is required to display membership details.');
            setLoading(false);
            return;
        }

        const fetchMember = async () => {
            setLoading(true);
            try {
                await refreshMember();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to load membership details.');
            } finally {
                setLoading(false);
            }
        };

        fetchMember();
    }, [referralId]);

    useEffect(() => {
        if (member?.wallet_address) {
            checkAllowance(member.wallet_address);
        }
    }, [member?.wallet_address]);

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
            <Toaster />
            <div className="w-full max-w-xl">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400 font-black">Customer Membership</p>
                        <h1 className="text-3xl font-black text-slate-900 mt-2">Membership Card</h1>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/'}
                    >
                        Back to Shop
                    </Button>
                </div>

                <div className="rounded-[3rem] bg-white shadow-2xl border border-slate-200 p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
                            <p className="text-sm font-black text-slate-500 uppercase">Loading membership details...</p>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center">
                            <Info className="mx-auto mb-4 w-10 h-10 text-amber-500" />
                            <p className="text-lg font-black text-slate-900">{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="rounded-[2.5rem] bg-slate-950 p-8 text-white text-center shadow-xl">
                                <div className="flex items-center justify-center mb-4">
                                    <ShieldCheck className="w-10 h-10 text-emerald-300" />
                                </div>
                                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Member Identifier</p>
                                <p className="mt-4 text-3xl font-black tracking-tight">{member.referral_id}</p>
                                <p className="mt-3 text-sm text-slate-400">{member.username || 'Unnamed Member'}</p>
                            </div>

                            <div className="grid gap-4">
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-xs uppercase tracking-[0.32em] text-slate-400 font-black">Contact</p>
                                        <Badge>{member.contact_info}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Identity Verified</p>
                                            <p className="mt-2 text-base font-black text-slate-900">{member.identity_verified ? 'Yes' : 'No'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Verified At</p>
                                            <p className="mt-2 text-base font-black text-slate-900">{member.verified_at || 'Not verified'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Fast Pay Authorization</p>
                                        <Badge>{allowanceAuthorized ? 'Fast Pay 已授权' : 'Disabled'}</Badge>
                                    </div>
                                    <div className="space-y-5">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Database Amount</p>
                                            <p className="mt-2 text-xl font-black text-slate-900">{member.fast_pay_allowance != null ? `${member.fast_pay_allowance} MUSD` : 'None'}</p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">On-chain Allowance</p>
                                            <p className="mt-2 text-xl font-black text-slate-900">
                                                {allowanceLoading ? 'Checking...' : allowance ? `${allowance.formatted} MUSD` : 'Unknown'}
                                            </p>
                                            <p className="mt-2 text-xs text-slate-500">
                                                Spender: {shortAddress(SHOPOS_PULL_PAYMENT_CONTRACT)}
                                            </p>
                                        </div>

                                        {staleAuthorization && (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 flex gap-3">
                                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                                <p className="text-sm font-bold">Fast Pay 授权已失效或不是当前合约，请重新授权</p>
                                            </div>
                                        )}

                                        {allowance && allowance.raw === 0n && !staleAuthorization && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 flex gap-3">
                                                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                                                <p className="text-sm font-bold">Fast Pay authorization is not active on-chain.</p>
                                            </div>
                                        )}

                                        {allowanceAuthorized && (
                                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                                                <p className="text-sm font-bold">Fast Pay 已授权</p>
                                            </div>
                                        )}

                                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Connected Wallet</p>
                                            <p className="mt-2 text-sm font-black text-slate-900">{shortAddress(walletAddress)}</p>
                                            {walletAddress && member.wallet_address && !walletMatchesMember && (
                                                <p className="mt-2 text-xs font-bold text-red-600">
                                                    Connected wallet does not match this member wallet: {shortAddress(member.wallet_address)}
                                                </p>
                                            )}
                                            {approveHash && (
                                                <p className="mt-2 text-xs text-slate-500">Last approve tx: {shortAddress(approveHash)}</p>
                                            )}
                                        </div>

                                        {allowanceError && (
                                            <p className="text-sm font-bold text-red-600">{allowanceError}</p>
                                        )}

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <Button
                                                variant="outline"
                                                onClick={connectWallet}
                                                disabled={approveLoading || allowanceLoading}
                                            >
                                                <Wallet className="mr-2 h-4 w-4" />
                                                {walletAddress ? 'Refresh Wallet' : 'Connect Wallet'}
                                            </Button>
                                            <Button
                                                onClick={reauthorizeFastPay}
                                                disabled={!walletAddress || !walletMatchesMember || approveLoading || allowanceLoading}
                                            >
                                                {approveLoading ? (
                                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                                )}
                                                重新授权 Fast Pay
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MembershipCardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
                <div className="w-full max-w-xl">
                    <div className="rounded-[3rem] bg-white shadow-2xl border border-slate-200 p-8">
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
                            <p className="text-sm font-black text-slate-500 uppercase">Loading membership details...</p>
                        </div>
                    </div>
                </div>
            </div>
        }>
            <MembershipCardContent />
        </Suspense>
    );
}
