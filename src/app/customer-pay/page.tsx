"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { ConnectKitButton, useModal } from 'connectkit';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { mezoTestnet, MEZO_RPC_URL, MUSD_ADDRESSES } from '@/app/lib/mezo-config';
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
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
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

type PaymentIntentDetails = {
  id: string;
  orderId: string;
  amountMUSD: number;
  token: 'MUSD';
  network: 'mezo-testnet';
  merchantWallet: string;
  status: 'pending' | 'detected' | 'confirmed' | 'expired' | 'failed';
  paymentIntentIdBytes32: string;
  orderIdBytes32: string;
};

type TokenDiagnostics = {
  envMusdTokenAddress: string;
  envShoposMusdToken: string;
  envMusdAddress: string;
  envMezoRpcUrl: string;
  envLegacySepoliaRpcUrl: string;
  musdAddress: string;
  paymentContract: string;
  merchantWallet: string;
  connectedWallet: string;
  currentChainId: string;
  rpcChainId: string;
  expectedChainId: string;
  rpcUrl: string;
  addressCollisionCheck: string;
  tokenBytecodePresent: 'yes' | 'no' | 'unknown';
  symbolResult: string;
  decimalsResult: string;
  balanceRaw: string;
  balanceFormatted: string;
  allowanceRaw: string;
  allowanceFormatted: string;
  amountInUnits: string;
  hasEnoughBalance: string;
  hasEnoughAllowance: string;
  lastFailedStep: string;
  exactErrorMessage: string;
};

const emptyDiagnostics: TokenDiagnostics = {
  envMusdTokenAddress: '',
  envShoposMusdToken: '',
  envMusdAddress: '',
  envMezoRpcUrl: '',
  envLegacySepoliaRpcUrl: '',
  musdAddress: '',
  paymentContract: '',
  merchantWallet: '',
  connectedWallet: '',
  currentChainId: '',
  rpcChainId: '',
  expectedChainId: String(mezoTestnet.id),
  rpcUrl: '',
  addressCollisionCheck: '',
  tokenBytecodePresent: 'unknown',
  symbolResult: '',
  decimalsResult: '',
  balanceRaw: '',
  balanceFormatted: '',
  allowanceRaw: '',
  allowanceFormatted: '',
  amountInUnits: '',
  hasEnoughBalance: '',
  hasEnoughAllowance: '',
  lastFailedStep: '',
  exactErrorMessage: ''
};

function shortAddress(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function sameAddress(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function isEvmAddress(value?: string) {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function getErrorMessage(err: any) {
  return err?.shortMessage || err?.message || 'Unknown error';
}

function chainName(chainId?: number | string) {
  const id = Number(chainId);
  if (id === 31611) return 'Mezo Testnet';
  if (id === 11155111) return 'Ethereum Sepolia';
  if (!Number.isFinite(id)) return 'Unknown chain';
  return `Unknown chain ${id}`;
}

function serializeError(err: any) {
  return {
    name: err?.name,
    message: err?.message,
    shortMessage: err?.shortMessage,
    cause: err?.cause,
    raw: err
  };
}

function logDebugSuccess(step: string, value?: unknown) {
  console.log(`[CustomerPayDebug] step=${step} success`, value !== undefined ? { value } : {});
}

function logDebugFailure(step: string, context: Record<string, unknown>, err: any) {
  console.error(`[CustomerPayDebug] step=${step} failed error=${getErrorMessage(err)}`, {
    ...context,
    ...serializeError(err)
  });
}

function metricValue(value: number | null, invalid: boolean) {
  if (invalid) return '-';
  return value != null ? formatMUSD(value) : '-';
}

export function CustomerPayContent({ paymentIntentIdFromPath = '' }: { paymentIntentIdFromPath?: string }) {
  const params = useSearchParams();
  const publicClient = usePublicClient();
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectors, error: connectError } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { setOpen: setConnectModalOpen } = useModal();

  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState<number | null>(null);
  const [rawBalance, setRawBalance] = useState<bigint | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenConfigInvalid, setTokenConfigInvalid] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>();
  const [paymentTxHash, setPaymentTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState('');
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [tokenDiagnostics, setTokenDiagnostics] = useState<TokenDiagnostics>(emptyDiagnostics);
  const [lastWriteError, setLastWriteError] = useState('');
  const [paymentIntentDetails, setPaymentIntentDetails] = useState<PaymentIntentDetails | null>(null);
  const [intentLoading, setIntentLoading] = useState(Boolean(paymentIntentIdFromPath));
  const [intentError, setIntentError] = useState('');
  const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);
  const [walletDebug, setWalletDebug] = useState({
    isMobile: 'unknown',
    hasWindowEthereum: 'unknown',
    walletConnectProjectIdPresent: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ? 'yes' : 'no'
  });

  const paymentIntentId = paymentIntentDetails?.id || params.get('paymentIntentId') || paymentIntentIdFromPath || '';
  const orderId = paymentIntentDetails?.orderId || params.get('orderId') || '';
  const paymentIntentIdBytes32 = paymentIntentDetails?.paymentIntentIdBytes32 || params.get('paymentIntentIdBytes32') || '';
  const orderIdBytes32 = paymentIntentDetails?.orderIdBytes32 || params.get('orderIdBytes32') || '';
  const merchant = paymentIntentDetails?.merchantWallet || params.get('merchant') || process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET || '';
  const amount = paymentIntentDetails?.amountMUSD || Number(params.get('amount') || 0);
  const network = paymentIntentDetails?.network || params.get('network') || 'mezo-testnet';

  // QR Payment Mode 2: Customer-initiated contract payment
  // Customer signs transaction to ShopOSPayment contract which emits OrderPaid event
  // This enables Goldsky webhook to index and reconcile orders deterministically
  const envMusdTokenAddress = process.env.NEXT_PUBLIC_MUSD_TOKEN_ADDRESS || '';
  const envShoposMusdToken = process.env.NEXT_PUBLIC_SHOPOS_MUSD_TOKEN || '';
  const envMusdAddress = process.env.NEXT_PUBLIC_MUSD_ADDRESS || '';
  const envMezoRpcUrl = process.env.NEXT_PUBLIC_MEZO_RPC_URL || '';
  const envLegacySepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || '';
  const musdAddress = MUSD_ADDRESSES.testnet;
  const paymentContract = process.env.NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT || '';
  const merchantEnv = process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET || '';
  const rpcUrl = MEZO_RPC_URL;

  const connectorSummary = useMemo(() => {
    if (!connectors.length) return '-';
    return connectors.map((item) => `${item.name} (${item.id})`).join(', ');
  }, [connectors]);
  const writeConnectorReady = Boolean(isConnected && address && connector && typeof writeContractAsync === 'function');
  const isMobileBrowserWithoutProvider = walletDebug.isMobile === 'yes' && walletDebug.hasWindowEthereum === 'no';
  const metaMaskDeepLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const currentUrl = window.location.href;
    const encoded = encodeURIComponent(currentUrl.replace(/^https?:\/\//, ''));
    return `https://link.metamask.io/dapp/${encoded}`;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const userAgent = window.navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    const hasEthereum = Boolean((window as any).ethereum);
    const nextDebug = {
      isMobile: isMobile ? 'yes' : 'no',
      hasWindowEthereum: hasEthereum ? 'yes' : 'no',
      walletConnectProjectIdPresent: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ? 'yes' : 'no'
    };
    setWalletDebug(nextDebug);
    console.log('[WalletConnectDebug] customer-pay wallet environment', {
      ...nextDebug,
      availableConnectors: connectors.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type
      })),
      selectedConnector: connector ? `${connector.name} (${connector.id})` : '-',
      connectionErrorMessage: connectError?.message || '-',
      writeConnectorReady: writeConnectorReady ? 'yes' : 'no',
      lastWriteError: lastWriteError || '-'
    });
  }, [connectError?.message, connector, connectors, lastWriteError, writeConnectorReady]);

  useEffect(() => {
    if (!paymentIntentIdFromPath) return;
    let cancelled = false;

    async function loadPaymentIntent() {
      setIntentLoading(true);
      setIntentError('');
      try {
        const res = await fetch(`/api/pos/payment-intents/${encodeURIComponent(paymentIntentIdFromPath)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error === 'Payment intent not found' ? 'Payment intent not found.' : data?.error || 'Payment intent not found.');
        }
        if (cancelled) return;
        setPaymentIntentDetails({
          id: data.id || data.paymentIntentId || paymentIntentIdFromPath,
          orderId: data.orderId,
          amountMUSD: Number(data.amountMUSD || 0),
          token: data.token || 'MUSD',
          network: data.network || 'mezo-testnet',
          merchantWallet: data.merchantWallet,
          status: data.status,
          paymentIntentIdBytes32: data.paymentIntentIdBytes32,
          orderIdBytes32: data.orderIdBytes32
        });
      } catch (err: any) {
        if (!cancelled) setIntentError(err.message || 'Payment intent not found.');
      } finally {
        if (!cancelled) setIntentLoading(false);
      }
    }

    loadPaymentIntent();
    return () => {
      cancelled = true;
    };
  }, [paymentIntentIdFromPath]);

  const amountInUnits = useMemo(() => {
    try {
      return parseUnits(amount.toFixed(2), decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalTxHash
  });

  const { isLoading: isPaymentConfirming, isSuccess: isPaymentConfirmed } = useWaitForTransactionReceipt({
    hash: paymentTxHash
  });

  const missingEnv = [
    !musdAddress ? 'MUSD token address (configure NEXT_PUBLIC_MUSD_TOKEN_ADDRESS)' : '',
    !paymentContract ? 'NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT' : '',
    !merchantEnv ? 'NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET' : '',
    !rpcUrl ? 'NEXT_PUBLIC_MEZO_RPC_URL' : ''
  ].filter(Boolean);

  const legacyMUSDSetupWarning = !envMusdTokenAddress && musdAddress
    ? 'Using legacy MUSD env variable. Prefer NEXT_PUBLIC_MUSD_TOKEN_ADDRESS for deployments.'
    : '';

  const tokenAddressConfigError = useMemo(() => {
    if (!musdAddress) return '';
    if (!isEvmAddress(musdAddress)) return 'MUSD token address is not a valid EVM address.';
    if (sameAddress(musdAddress, merchantEnv) || sameAddress(musdAddress, merchant)) return 'MUSD token address matches the merchant wallet address.';
    if (sameAddress(musdAddress, paymentContract)) return 'MUSD token address matches the ShopOS payment contract.';
    return '';
  }, [merchant, merchantEnv, musdAddress, paymentContract]);

  const addressCollisionCheck = tokenAddressConfigError || 'ok - MUSD address is distinct from merchant and payment contract addresses';
  
  const hasRequiredParams = Boolean(paymentIntentId && orderId && paymentIntentIdBytes32 && orderIdBytes32 && merchant && amount > 0);
  const isWrongNetwork = isConnected && chainId !== mezoTestnet.id;
  const hasEnoughBalance = balance != null && balance >= amount;
  const hasDiagnosticsError = Boolean(tokenDiagnostics.exactErrorMessage);

  const loadTokenState = useCallback(async () => {
    const baseDiagnostics: TokenDiagnostics = {
      ...emptyDiagnostics,
      envMusdTokenAddress,
      envShoposMusdToken,
      envMusdAddress,
      envMezoRpcUrl,
      envLegacySepoliaRpcUrl,
      musdAddress: musdAddress || '',
      paymentContract,
      merchantWallet: merchant || merchantEnv || '',
      connectedWallet: address || '',
      currentChainId: chainId?.toString() || '',
      rpcChainId: '',
      expectedChainId: String(mezoTestnet.id),
      rpcUrl,
      addressCollisionCheck,
      amountInUnits: amountInUnits.toString()
    };

    const failStep = (stepName: string, message: string, extra?: Partial<TokenDiagnostics>) => {
      setTokenDiagnostics({
        ...baseDiagnostics,
        ...extra,
        lastFailedStep: stepName,
        exactErrorMessage: message
      });
      setError(message);
    };

    setLoadingBalances(true);
    setError('');
    setTokenConfigInvalid(false);
    setRawBalance(null);
    setBalance(null);
    setNeedsApproval(false);
    setTokenDiagnostics(baseDiagnostics);

    if (tokenAddressConfigError) {
      const message = tokenAddressConfigError.includes('not a valid EVM address')
        ? 'MUSD address is not a valid EVM address'
        : tokenAddressConfigError;
      logDebugFailure('validateEnvAddressFormat', {
        tokenAddress: musdAddress,
        merchantWallet: merchant,
        chainId: chainId || mezoTestnet.id,
        connectedWallet: address,
        functionName: undefined,
        args: []
      }, new Error(message));
      setTokenConfigInvalid(true);
      failStep('validateEnvAddressFormat', message);
      setLoadingBalances(false);
      return;
    }

    if (!isEvmAddress(paymentContract)) {
      const message = 'ShopOSPayment contract address is not a valid EVM address';
      logDebugFailure('validatePaymentContractAddressFormat', {
        inputAddress: paymentContract,
        chainId,
        functionName: undefined,
        args: []
      }, new Error(message));
      failStep('validatePaymentContractAddressFormat', message);
      setLoadingBalances(false);
      return;
    }

    try {
      logDebugSuccess('validateEnvAddressFormat', musdAddress);

      if (!address) {
        failStep('checkConnectedWallet', 'Wallet is not connected');
        logDebugFailure('checkConnectedWallet', { tokenAddress: musdAddress, chainId, functionName: undefined, args: [] }, new Error('Wallet is not connected'));
        return;
      }
      logDebugSuccess('checkConnectedWallet', address);

      if (chainId !== mezoTestnet.id) {
        failStep('checkChainId', 'Wallet is connected to the wrong chain');
        logDebugFailure('checkChainId', { tokenAddress: musdAddress, chainId, expectedChainId: mezoTestnet.id, functionName: undefined, args: [] }, new Error('Wallet is connected to the wrong chain'));
        return;
      }
      logDebugSuccess('checkChainId', chainId);

      if (!publicClient) {
        failStep('checkPublicClientAvailability', 'Public client is unavailable');
        logDebugFailure('checkPublicClientAvailability', { tokenAddress: musdAddress, chainId, functionName: undefined, args: [] }, new Error('Public client is unavailable'));
        return;
      }
      logDebugSuccess('checkPublicClientAvailability', 'available');

      let nextDiagnostics = baseDiagnostics;
      const setPartialDiagnostics = (partial: Partial<TokenDiagnostics>) => {
        nextDiagnostics = { ...nextDiagnostics, ...partial };
        setTokenDiagnostics(nextDiagnostics);
      };

      try {
        const rpcChainId = await publicClient.getChainId();
        setPartialDiagnostics({ rpcChainId: rpcChainId.toString() });
        if (rpcChainId !== mezoTestnet.id) {
          const message = `RPC chainId mismatch. Configured RPC is ${chainName(rpcChainId)} (${rpcChainId}), but payments require ${chainName(mezoTestnet.id)} (${mezoTestnet.id}). Set NEXT_PUBLIC_MEZO_RPC_URL=https://rpc.test.mezo.org in the deployed environment.`;
          failStep('checkRpcChainId', message, { ...nextDiagnostics, rpcChainId: rpcChainId.toString() });
          logDebugFailure('checkRpcChainId', { rpcUrl, chainId, expectedChainId: mezoTestnet.id, functionName: 'eth_chainId', args: [] }, new Error(message));
          return;
        }
        logDebugSuccess('checkRpcChainId', rpcChainId);
      } catch (err: any) {
        const message = `RPC chainId request failed: ${getErrorMessage(err)}`;
        failStep('checkRpcChainId', message, nextDiagnostics);
        logDebugFailure('checkRpcChainId', { rpcUrl, chainId, expectedChainId: mezoTestnet.id, functionName: 'eth_chainId', args: [] }, err);
        return;
      }

      let bytecode: `0x${string}` | undefined;
      try {
        bytecode = await publicClient.getCode({ address: musdAddress as `0x${string}` });
        const tokenBytecodePresent = bytecode && bytecode !== '0x' ? 'yes' : 'no';
        setPartialDiagnostics({ tokenBytecodePresent });
        if (tokenBytecodePresent === 'no') {
          throw new Error('No bytecode found at MUSD address');
        }
        logDebugSuccess('readTokenBytecode', tokenBytecodePresent);
      } catch (err: any) {
        const message = getErrorMessage(err).includes('No bytecode') ? 'No bytecode found at MUSD address' : `RPC request failed: ${getErrorMessage(err)}`;
        setTokenConfigInvalid(getErrorMessage(err).includes('No bytecode'));
        failStep('readTokenBytecode', message, nextDiagnostics);
        logDebugFailure('readTokenBytecode', { tokenAddress: musdAddress, chainId, functionName: 'eth_getCode', args: [musdAddress] }, err);
        return;
      }

      let symbol: string;
      try {
        symbol = String(await publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol'
        }));
        setTokenSymbol(symbol);
        setPartialDiagnostics({ symbolResult: symbol });
        logDebugSuccess('readSymbol', symbol);
      } catch (err: any) {
        setTokenConfigInvalid(true);
        failStep('readSymbol', `symbol() call failed: ${getErrorMessage(err)}`, nextDiagnostics);
        logDebugFailure('readSymbol', { inputAddress: musdAddress, chainId, functionName: 'symbol', args: [] }, err);
        return;
      }

      let tokenDecimals: number;
      try {
        tokenDecimals = Number(await publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'decimals'
        }));
        setDecimals(tokenDecimals);
        setPartialDiagnostics({ decimalsResult: tokenDecimals.toString() });
        logDebugSuccess('readDecimals', tokenDecimals);
      } catch (err: any) {
        setTokenConfigInvalid(true);
        failStep('readDecimals', `decimals() call failed: ${getErrorMessage(err)}`, nextDiagnostics);
        logDebugFailure('readDecimals', { inputAddress: musdAddress, chainId, functionName: 'decimals', args: [] }, err);
        return;
      }

      let amountUnits: bigint;
      try {
        amountUnits = parseUnits(amount.toFixed(2), tokenDecimals);
        setPartialDiagnostics({ amountInUnits: amountUnits.toString() });
        logDebugSuccess('calculateAmountInUnits', amountUnits.toString());
      } catch (err: any) {
        failStep('calculateAmountInUnits', `Amount conversion failed: ${getErrorMessage(err)}`, nextDiagnostics);
        logDebugFailure('calculateAmountInUnits', { inputAddress: musdAddress, chainId, functionName: 'parseUnits', args: [amount.toFixed(2), tokenDecimals] }, err);
        return;
      }

      let rawBalanceResult: bigint;
      let formattedBalance: string;
      try {
        rawBalanceResult = await publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address]
        });
        formattedBalance = formatUnits(rawBalanceResult, tokenDecimals);
        setRawBalance(rawBalanceResult);
        setBalance(Number(formattedBalance));
        setPartialDiagnostics({ balanceRaw: rawBalanceResult.toString(), balanceFormatted: formattedBalance });
        logDebugSuccess('readBalance', formattedBalance);
      } catch (err: any) {
        setTokenConfigInvalid(true);
        failStep('readBalance', `balanceOf(customer) call failed: ${getErrorMessage(err)}`, nextDiagnostics);
        logDebugFailure('readBalance', { inputAddress: musdAddress, chainId, functionName: 'balanceOf', args: [address] }, err);
        return;
      }

      let rawAllowanceResult = 0n;
      let formattedAllowance = '0';
      try {
        rawAllowanceResult = await publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, paymentContract as `0x${string}`]
        });
        formattedAllowance = formatUnits(rawAllowanceResult, tokenDecimals);
        setPartialDiagnostics({ allowanceRaw: rawAllowanceResult.toString(), allowanceFormatted: formattedAllowance });
        logDebugSuccess('readAllowance', formattedAllowance);
      } catch (err: any) {
        failStep('readAllowance', `Allowance read failed: ${getErrorMessage(err)}`, nextDiagnostics);
        logDebugFailure('readAllowance', { inputAddress: musdAddress, chainId, functionName: 'allowance', args: [address, paymentContract] }, err);
        return;
      }

      const enoughBalance = rawBalanceResult >= amountUnits;
      const enoughAllowance = rawAllowanceResult >= amountUnits;
      setNeedsApproval(!enoughAllowance);
      setPartialDiagnostics({
        hasEnoughBalance: enoughBalance ? 'yes' : 'no',
        hasEnoughAllowance: enoughAllowance ? 'yes' : 'no',
        lastFailedStep: '',
        exactErrorMessage: ''
      });
      logDebugSuccess('calculateHasEnoughBalance', enoughBalance ? 'yes' : 'no');
      logDebugSuccess('calculateHasEnoughAllowance', enoughAllowance ? 'yes' : 'no');

      console.log('[CustomerPayDebug] Token diagnostics completed:', {
        paymentMode: 'qr-contract-payment-mode-2',
        tokenAddress: musdAddress,
        paymentContract,
        chainId: chainId || mezoTestnet.id,
        connectedWallet: address,
        merchantWallet: merchant,
        decimals: tokenDecimals,
        symbol,
        balance: formattedBalance,
        allowance: formattedAllowance,
        hasEnoughBalance: enoughBalance,
        hasEnoughAllowance: enoughAllowance,
      });
    } catch (err: any) {
      console.error('[CustomerPayDebug] Unexpected diagnostics failure:', {
        tokenAddress: musdAddress,
        paymentContract,
        chainId: chainId || mezoTestnet.id,
        connectedWallet: address,
        contractCallFailureReason: err.shortMessage || err.message || 'Unknown error',
        errorDetails: err,
      });
      failStep('unexpectedTokenDiagnosticsFailure', `Token diagnostics failed: ${getErrorMessage(err)}`);
    } finally {
      setLoadingBalances(false);
    }
  }, [address, addressCollisionCheck, amount, amountInUnits, envLegacySepoliaRpcUrl, envMezoRpcUrl, envMusdAddress, envMusdTokenAddress, envShoposMusdToken, musdAddress, paymentContract, publicClient, chainId, tokenAddressConfigError, merchant, merchantEnv, rpcUrl]);

  useEffect(() => {
    if (isConnected && !isWrongNetwork) {
      loadTokenState();
    }
  }, [isConnected, isWrongNetwork, loadTokenState]);

  const hasEnoughAllowance = tokenDiagnostics.hasEnoughAllowance === 'yes';

  useEffect(() => {
    if (isPaymentConfirmed && (step === 'paying' || step === 'submitted')) {
      setStep('confirmed');
    }
  }, [isPaymentConfirmed, step]);

  useEffect(() => {
    if (!isPaymentConfirmed || !paymentTxHash || !paymentIntentId) return;
    let cancelled = false;

    async function submitPaymentTx() {
      try {
        const res = await fetch(`/api/payment-intents/${encodeURIComponent(paymentIntentId)}/submit-tx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash: paymentTxHash })
        });
        const data = await res.json();
        if (!res.ok && !cancelled) {
          setError(data?.error || 'Payment failed');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Payment failed');
      }
    }

    submitPaymentTx();
    return () => {
      cancelled = true;
    };
  }, [isPaymentConfirmed, paymentIntentId, paymentTxHash]);

  useEffect(() => {
    if (isApprovalConfirmed) {
      loadTokenState();
    }
  }, [isApprovalConfirmed, loadTokenState]);

  useEffect(() => {
    if (hasEnoughAllowance && step === 'approving') {
      setStep('idle');
    }
  }, [hasEnoughAllowance, step]);

  const connectWallet = (show?: () => void) => {
    // Use ConnectKit modal to show wallet selector (same as register page)
    setError('');
    console.log('[WalletConnectDebug] connect wallet clicked', {
      isMobile: walletDebug.isMobile,
      hasWindowEthereum: walletDebug.hasWindowEthereum,
      walletConnectProjectIdPresent: walletDebug.walletConnectProjectIdPresent,
      availableConnectors: connectors.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type
      })),
      selectedConnector: connector ? `${connector.name} (${connector.id})` : '-',
      connectionErrorMessage: connectError?.message || '-',
      writeConnectorReady: writeConnectorReady ? 'yes' : 'no'
    });

    if (typeof show === 'function') {
      show();
      return;
    }

    setConnectModalOpen(true);
  };

  const switchToMezo = async () => {
    setError('');
    try {
      await switchChain({ chainId: mezoTestnet.id });
    } catch (err: any) {
      setError(err.message || 'Please switch to Mezo.');
    }
  };

  const openInMetaMask = () => {
    console.log('[WalletConnectDebug] open in MetaMask clicked', {
      isMobile: walletDebug.isMobile,
      hasWindowEthereum: walletDebug.hasWindowEthereum,
      deeplink: metaMaskDeepLink,
      currentUrl: typeof window !== 'undefined' ? window.location.href : '-'
    });
    if (metaMaskDeepLink) window.location.href = metaMaskDeepLink;
  };

  const copyPaymentLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedPaymentLink(true);
      window.setTimeout(() => setCopiedPaymentLink(false), 1500);
    } catch {
      setError('Unable to copy payment link.');
    }
  };

  const requireWriteConnector = () => {
    if (writeConnectorReady) return true;
    const message = 'Wallet is not connected for signing. Please connect using MetaMask app browser or WalletConnect.';
    setLastWriteError(message);
    setError(message);
    console.warn('[WalletConnectDebug] write blocked: no signer connector', {
      isMobile: walletDebug.isMobile,
      hasWindowEthereum: walletDebug.hasWindowEthereum,
      wagmiIsConnected: isConnected ? 'yes' : 'no',
      connectedAddress: address || '-',
      connector: connector ? `${connector.name} (${connector.id})` : '-',
      availableConnectors: connectors.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type
      })),
      walletConnectProjectIdPresent: walletDebug.walletConnectProjectIdPresent,
      writeConnectorReady: 'no'
    });
    return false;
  };

  const approveMusd = async () => {
    setError('');
    setLastWriteError('');
    if (!requireWriteConnector()) return;
    if (missingEnv.length > 0) {
      setError(`Missing environment configuration: ${missingEnv.join(', ')}.`);
      return;
    }
    if (tokenConfigInvalid || tokenAddressConfigError) {
      setError(tokenDiagnostics.exactErrorMessage || tokenAddressConfigError || 'Token diagnostics failed. Run diagnostics for details.');
      return;
    }
    if (!hasEnoughBalance) {
      setError('Insufficient MUSD balance.');
      return;
    }

    try {
      setStep('approving');
      // QR Contract Payment Mode 2: Approve ShopOSPayment contract to spend MUSD
      // This is NOT Fast Pay allowance - this is one-time approval for this specific payment
      const hash = await writeContractAsync({
        address: musdAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [paymentContract as `0x${string}`, amountInUnits]
      });
      setApprovalTxHash(hash);
      
      console.log('[CustomerPay] Approval transaction submitted:', {
        paymentMode: 'qr-contract-payment-mode-2',
        tokenAddress: musdAddress,
        spenderContract: paymentContract,
        amount: amountInUnits.toString(),
        txHash: hash,
      });
    } catch (err: any) {
      setStep('idle');
      const message = err.message?.toLowerCase().includes('rejected') ? 'Payment cancelled by user' : err.message || 'Payment failed';
      setLastWriteError(message);
      setError(message);
    }
  };

  const payOrder = async () => {
    setError('');
    setLastWriteError('');
    if (!requireWriteConnector()) return;
    if (missingEnv.length > 0) {
      setError(`Missing environment configuration: ${missingEnv.join(', ')}.`);
      return;
    }
    if (tokenConfigInvalid || tokenAddressConfigError) {
      setError(tokenDiagnostics.exactErrorMessage || tokenAddressConfigError || 'Token diagnostics failed. Run diagnostics for details.');
      return;
    }
    if (!hasEnoughBalance) {
      setError('Insufficient MUSD balance.');
      return;
    }

    try {
      setStep('paying');
      // QR Contract Payment Mode 2: Call ShopOSPayment.payOrder() which emits OrderPaid event
      // Goldsky webhook indexes this event and reconciles the order
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
      setPaymentTxHash(hash);
      setStep('submitted');
      
      console.log('[PaymentIntentIdentity] customer-pay contract args', {
        paymentIntentId,
        paymentRef: paymentIntentId,
        orderId,
        amount,
        paymentIntentIdBytes32,
        orderIdBytes32,
        contractFunction: 'ShopOSPayment.payOrder'
      });
      console.log('[CustomerPay] Payment transaction submitted:', {
        paymentMode: 'qr-contract-payment-mode-2',
        paymentContract,
        paymentIntentIdBytes32,
        orderIdBytes32,
        merchant,
        amount: amountInUnits.toString(),
        txHash: hash,
      });
    } catch (err: any) {
      setStep('idle');
      const message = err.message?.toLowerCase().includes('rejected') ? 'Payment cancelled by user' : err.message || 'Payment failed';
      setLastWriteError(message);
      setError(message);
    }
  };

  const primaryAction = () => {
    if (!writeConnectorReady) {
      setError('Wallet is not connected for signing. Please connect using MetaMask app browser or WalletConnect.');
      return connectWallet();
    }
    if (isWrongNetwork) return switchToMezo();
    if (tokenConfigInvalid || tokenAddressConfigError || hasDiagnosticsError) return undefined;
    if (!hasEnoughBalance) return undefined;
    return needsApproval ? approveMusd() : payOrder();
  };

  const primaryLabel = !writeConnectorReady
    ? 'Connect Wallet'
    : isWrongNetwork
      ? 'Switch to Mezo Testnet'
      : tokenConfigInvalid || tokenAddressConfigError || hasDiagnosticsError
        ? 'Token diagnostics failed'
        : !hasEnoughBalance
        ? 'Insufficient MUSD balance'
        : step === 'approving' && !hasEnoughAllowance
        ? 'Approving...'
        : step === 'paying'
        ? 'Paying...'
        : needsApproval
        ? 'Approve MUSD'
        : 'Pay MUSD';

  const disablePrimary =
    loadingBalances ||
    (step === 'approving' && !hasEnoughAllowance) ||
    step === 'paying' ||
    isPaymentConfirming ||
    step === 'submitted' ||
    step === 'confirmed' ||
    intentLoading ||
    !hasRequiredParams ||
    (writeConnectorReady && !isWrongNetwork && (tokenConfigInvalid || !!tokenAddressConfigError || hasDiagnosticsError || !hasEnoughBalance));

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
          {intentLoading ? (
            <StatusBox tone="warn" text="Loading payment intent..." />
          ) : intentError ? (
            <StatusBox tone="error" text="Payment intent not found." />
          ) : missingEnv.length > 0 ? (
            <StatusBox tone="error" text={`Missing environment configuration: ${missingEnv.join(', ')}.`} />
          ) : !hasRequiredParams ? (
            <StatusBox tone="error" text="Invalid payment link. Missing payment intent details." />
          ) : (
            <>
              {isMobileBrowserWithoutProvider && !writeConnectorReady ? (
                <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-sm font-black text-orange-900">Mobile Wallet Options</p>
                  <p className="mt-2 text-sm font-bold text-orange-800">
                    This browser cannot sign blockchain transactions directly. Please open this payment page in a wallet app.
                  </p>
                  <Button className="mt-4 h-11 w-full rounded-xl bg-orange-600 text-sm font-black text-white hover:bg-red-950" onClick={openInMetaMask} type="button">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in MetaMask
                  </Button>
                  <ConnectKitButton.Custom>
                    {({ show }) => (
                      <Button className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-slate-50" onClick={() => connectWallet(show)} type="button">
                        <Wallet className="mr-2 h-4 w-4" />
                        Connect with WalletConnect
                      </Button>
                    )}
                  </ConnectKitButton.Custom>
                  <Button className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-slate-50" onClick={copyPaymentLink} type="button">
                    <Copy className="mr-2 h-4 w-4" />
                    {copiedPaymentLink ? 'Copied' : 'Copy payment link'}
                  </Button>
                </div>
              ) : null}

              {isConnected ? (
                <div className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold">
                  <p className="text-slate-500">Customer wallet</p>
                  <p className="mt-1 break-all text-slate-950">{address}</p>
                </div>
              ) : null}

              {isConnected && !writeConnectorReady ? (
                <StatusBox tone="warn" text="Wallet address is visible, but no signing connector is active. Reconnect with MetaMask app browser or WalletConnect before approving." />
              ) : null}

              {isConnected && !isWrongNetwork ? (
                <div className="mb-4">
                  <Metric label="MUSD Balance" value={loadingBalances ? 'Loading...' : metricValue(balance, tokenConfigInvalid || !!tokenAddressConfigError)} />
                </div>
              ) : null}

              {isWrongNetwork ? <StatusBox tone="warn" text="Please switch to Mezo." /> : null}
              {legacyMUSDSetupWarning ? <StatusBox tone="warn" text={legacyMUSDSetupWarning} /> : null}
              {!isWrongNetwork && isConnected && (tokenConfigInvalid || tokenAddressConfigError || hasDiagnosticsError) ? (
                <StatusBox tone="error" text={tokenDiagnostics.exactErrorMessage || tokenAddressConfigError || 'Token diagnostics failed.'} />
              ) : null}
              {!isWrongNetwork && isConnected && !tokenConfigInvalid && !tokenAddressConfigError && balance != null && !hasEnoughBalance ? <StatusBox tone="error" text="Insufficient MUSD balance." /> : null}
              
              {/* Payment Mode Indicator */}
              {!isWrongNetwork && isConnected && !tokenConfigInvalid && !tokenAddressConfigError && !hasDiagnosticsError && (
                <div className="mb-2 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700">
                  <p>QR Contract Payment - Mode 2</p>
                  <p className="text-xs font-normal text-blue-600">Customer signs transaction. ShopOSPayment contract emits OrderPaid event for Goldsky indexing.</p>
                </div>
              )}

              {!writeConnectorReady && !isMobileBrowserWithoutProvider ? (
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <Button
                      className="mt-4 h-12 w-full rounded-xl bg-orange-600 text-base font-black text-white hover:bg-red-950"
                      disabled={disablePrimary}
                      onClick={() => connectWallet(show)}
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      {primaryLabel}
                    </Button>
                  )}
                </ConnectKitButton.Custom>
              ) : writeConnectorReady ? (
                <Button
                  className="mt-4 h-12 w-full rounded-xl bg-orange-600 text-base font-black text-white hover:bg-red-950"
                  disabled={disablePrimary}
                  onClick={primaryAction}
                >
                  {loadingBalances || step === 'approving' || step === 'paying' || isPaymentConfirming ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 h-4 w-4" />
                  )}
                  {primaryLabel}
                </Button>
              ) : null}
              {walletDebug.isMobile === 'yes' && !writeConnectorReady ? (
                <StatusBox tone="warn" text="Please open this payment page in MetaMask, OKX Wallet, Trust Wallet, or connect with WalletConnect." />
              ) : null}
              <Button
                className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-slate-50"
                disabled={loadingBalances}
                onClick={loadTokenState}
                type="button"
              >
                {loadingBalances ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Run Token Diagnostics
              </Button>
            </>
          )}
        </div>

        {approvalTxHash ? (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-950">Approval Transaction</p>
            <p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{approvalTxHash}</p>
            {isApprovalConfirming && !hasEnoughAllowance ? <StatusBox tone="warn" text="Waiting for allowance confirmation..." /> : null}
            {hasEnoughAllowance ? <StatusBox tone="success" text="MUSD approval ready" /> : null}
          </div>
        ) : null}

        {paymentTxHash ? (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-950">Payment Transaction</p>
            <p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{paymentTxHash}</p>
            {step === 'submitted' || isPaymentConfirming ? <StatusBox tone="warn" text="Waiting for blockchain confirmation" /> : null}
            {step === 'confirmed' ? <StatusBox tone="success" text="Payment Submitted" /> : null}
            {step === 'submitted' || step === 'confirmed' || isPaymentConfirming ? (
              <p className="mt-3 text-xs font-bold text-slate-500">
                The POS will be confirmed automatically by the Goldsky webhook after the OrderPaid event is indexed.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">Token Load Trace</p>
          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
            <TraceRow label="1. Wallet connected" status={isConnected ? 'pass' : 'pending'} detail={address || 'Not connected'} />
            <TraceRow label="2. Wallet chain" status={!isConnected ? 'pending' : isWrongNetwork ? 'fail' : 'pass'} detail={`current=${chainId || '-'}, expected=${mezoTestnet.id}`} />
            <TraceRow label="3. Address wiring" status={tokenAddressConfigError ? 'fail' : musdAddress ? 'pass' : 'fail'} detail={addressCollisionCheck || 'Missing MUSD token address'} />
            <TraceRow label="4. RPC chain" status={!tokenDiagnostics.rpcChainId ? 'pending' : tokenDiagnostics.rpcChainId === String(mezoTestnet.id) ? 'pass' : 'fail'} detail={`rpc=${tokenDiagnostics.rpcChainId || '-'}, expected=${mezoTestnet.id}`} />
            <TraceRow label="5. Token bytecode" status={tokenDiagnostics.tokenBytecodePresent === 'yes' ? 'pass' : tokenDiagnostics.tokenBytecodePresent === 'no' ? 'fail' : 'pending'} detail={tokenDiagnostics.tokenBytecodePresent} />
            <TraceRow label="6. symbol()" status={tokenDiagnostics.symbolResult ? 'pass' : tokenDiagnostics.lastFailedStep === 'readSymbol' ? 'fail' : 'pending'} detail={tokenDiagnostics.symbolResult || '-'} />
            <TraceRow label="7. decimals()" status={tokenDiagnostics.decimalsResult ? 'pass' : tokenDiagnostics.lastFailedStep === 'readDecimals' ? 'fail' : 'pending'} detail={tokenDiagnostics.decimalsResult || '-'} />
            <TraceRow label="8. balanceOf(customer)" status={tokenDiagnostics.balanceRaw ? 'pass' : tokenDiagnostics.lastFailedStep === 'readBalance' ? 'fail' : 'pending'} detail={tokenDiagnostics.balanceFormatted || tokenDiagnostics.exactErrorMessage || '-'} />
            <TraceRow label="9. allowance(customer, ShopOSPayment)" status={tokenDiagnostics.allowanceRaw ? 'pass' : tokenDiagnostics.lastFailedStep === 'readAllowance' ? 'fail' : 'pending'} detail={tokenDiagnostics.allowanceFormatted || tokenDiagnostics.exactErrorMessage || '-'} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">Diagnostics</p>
          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
            <DebugRow label="payment mode" value="QR Contract Payment (Mode 2)" />
            <DebugRow label="NEXT_PUBLIC_MUSD_TOKEN_ADDRESS" value={tokenDiagnostics.envMusdTokenAddress || envMusdTokenAddress || '-'} />
            <DebugRow label="NEXT_PUBLIC_SHOPOS_MUSD_TOKEN" value={tokenDiagnostics.envShoposMusdToken || envShoposMusdToken || '-'} />
            <DebugRow label="NEXT_PUBLIC_MUSD_ADDRESS" value={tokenDiagnostics.envMusdAddress || envMusdAddress || '-'} />
            <DebugRow label="NEXT_PUBLIC_MEZO_RPC_URL" value={tokenDiagnostics.envMezoRpcUrl || envMezoRpcUrl || '-'} />
            <DebugRow label="NEXT_PUBLIC_SEPOLIA_RPC_URL legacy" value={tokenDiagnostics.envLegacySepoliaRpcUrl || envLegacySepoliaRpcUrl || '-'} />
            <DebugRow label="resolved MUSD token address" value={tokenDiagnostics.musdAddress || musdAddress || '-'} />
            <DebugRow label="ShopOSPayment contract address" value={tokenDiagnostics.paymentContract || paymentContract || '-'} />
            <DebugRow label="merchant wallet" value={tokenDiagnostics.merchantWallet || merchant || '-'} />
            <DebugRow label="connected wallet" value={tokenDiagnostics.connectedWallet || address || '-'} />
            <DebugRow label="current chainId" value={tokenDiagnostics.currentChainId || chainId?.toString() || '-'} />
            <DebugRow label="wallet debug isMobile" value={walletDebug.isMobile} />
            <DebugRow label="wallet debug window.ethereum" value={walletDebug.hasWindowEthereum} />
            <DebugRow label="wagmi isConnected" value={isConnected ? 'yes' : 'no'} />
            <DebugRow label="WalletConnect projectId present" value={walletDebug.walletConnectProjectIdPresent} />
            <DebugRow label="available wallet connectors" value={connectorSummary} />
            <DebugRow label="selected wallet connector" value={connector ? `${connector.name} (${connector.id})` : '-'} />
            <DebugRow label="write connector ready" value={writeConnectorReady ? 'yes' : 'no'} />
            <DebugRow label="wallet connection error" value={connectError?.message || '-'} />
            <DebugRow label="last write error" value={lastWriteError || '-'} />
            <DebugRow label="RPC chainId" value={tokenDiagnostics.rpcChainId || '-'} />
            <DebugRow label="expected chainId" value={tokenDiagnostics.expectedChainId || String(mezoTestnet.id)} />
            <DebugRow label="RPC URL" value={tokenDiagnostics.rpcUrl || rpcUrl || '-'} />
            <DebugRow label="address collision check" value={tokenDiagnostics.addressCollisionCheck || addressCollisionCheck || '-'} />
            <DebugRow label="token bytecode present" value={tokenDiagnostics.tokenBytecodePresent} />
            <DebugRow label="symbol result" value={tokenDiagnostics.symbolResult || tokenSymbol || '-'} />
            <DebugRow label="decimals result" value={tokenDiagnostics.decimalsResult || decimals.toString()} />
            <DebugRow label="balance raw" value={tokenDiagnostics.balanceRaw || rawBalance?.toString() || '-'} />
            <DebugRow label="balance formatted" value={tokenDiagnostics.balanceFormatted || balance?.toString() || '-'} />
            <DebugRow label="allowance raw" value={tokenDiagnostics.allowanceRaw || '-'} />
            <DebugRow label="allowance formatted" value={tokenDiagnostics.allowanceFormatted || '-'} />
            <DebugRow label="amountInUnits" value={tokenDiagnostics.amountInUnits || amountInUnits.toString()} />
            <DebugRow label="has enough balance" value={tokenDiagnostics.hasEnoughBalance || '-'} />
            <DebugRow label="has enough allowance" value={tokenDiagnostics.hasEnoughAllowance || '-'} />
            <DebugRow label="last failed step" value={tokenDiagnostics.lastFailedStep || '-'} />
            <DebugRow label="exact error message" value={tokenDiagnostics.exactErrorMessage || '-'} />
            <DebugRow label="payment method" value="ShopOSPayment.payOrder() → emits OrderPaid event" />
            <DebugRow label="Goldsky webhook" value="Indexes OrderPaid(paymentIntentId, orderId, merchant, payer, token, amount)" />
            <DebugRow label="order reconciliation" value="Deterministic via paymentIntentId/orderId in event" />
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

function TraceRow({ label, status, detail }: { label: string; status: 'pass' | 'fail' | 'pending'; detail: string }) {
  const classes = {
    pass: 'bg-emerald-100 text-emerald-700',
    fail: 'bg-red-100 text-red-700',
    pending: 'bg-slate-200 text-slate-500'
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2 rounded-xl bg-white p-2">
      <div className="min-w-0">
        <p className="text-slate-900">{label}</p>
        <p className="mt-1 break-all text-[11px] font-semibold text-slate-500">{detail}</p>
      </div>
      <span className={`self-start rounded-full px-2 py-1 text-center text-[10px] font-black uppercase ${classes[status]}`}>
        {status}
      </span>
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
