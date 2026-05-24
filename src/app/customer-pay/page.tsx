"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, RefreshCw, Wallet } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
  useSignTypedData
} from 'wagmi';
import { ConnectKitButton, useModal } from 'connectkit';
import { useRouter, useSearchParams } from 'next/navigation';
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
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
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
    name: 'musd',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
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
  },
  {
    name: 'payOrderWithPermit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'paymentIntentId', type: 'bytes32' },
      { name: 'orderId', type: 'bytes32' },
      { name: 'merchant', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' }
    ],
    outputs: []
  }
] as const;

// Payment step state machine — no 'approving' step ever exists.
// signing_permit: waiting for EIP-712 off-chain signature (wallet shows "Signature request", NOT "Spending cap")
// paying: submitting the on-chain payOrderWithPermit transaction
// confirming: wagmi waiting for tx receipt
// confirmed: tx mined, navigating to success
// failed: unrecoverable error (user can retry from idle)
type Step = 'idle' | 'signing_permit' | 'simulating' | 'paying' | 'confirming' | 'confirmed' | 'failed';
type PaymentMode = 'permit' | 'direct_transfer';

const PERMIT_VERSION = '1';

const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
} as const;

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
  contractMusdAddress: string;
  musdAddressMatch: string;
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
  permitDomainName: string;
  permitDomainVersion: string;
  permitDomainChainId: string;
  permitDomainVerifyingContract: string;
  permitOwner: string;
  permitSpender: string;
  permitValue: string;
  permitNonce: string;
  permitDeadline: string;
  permitSimulationStatus: string;
  permitSimulationError: string;
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
  contractMusdAddress: '',
  musdAddressMatch: '',
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
  permitDomainName: '',
  permitDomainVersion: '',
  permitDomainChainId: '',
  permitDomainVerifyingContract: '',
  permitOwner: '',
  permitSpender: '',
  permitValue: '',
  permitNonce: '',
  permitDeadline: '',
  permitSimulationStatus: '',
  permitSimulationError: '',
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

function permitDiagnosticsPayload(input: {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  musdAddress: string;
  contractMusdAddress: string;
  paymentContract: string;
  merchant: string;
  paymentIntentIdBytes32: string;
  orderIdBytes32: string;
  amount: bigint;
  chainId?: number;
  connectedWallet?: string;
}) {
  return {
    owner: input.owner,
    spender: input.spender,
    value: input.value.toString(),
    nonce: input.nonce.toString(),
    deadline: input.deadline.toString(),
    domainName: input.domain.name,
    domainVersion: input.domain.version,
    domainChainId: String(input.domain.chainId),
    domainVerifyingContract: input.domain.verifyingContract,
    resolvedMusdAddress: input.musdAddress,
    contractMusdAddress: input.contractMusdAddress,
    paymentContract: input.paymentContract,
    merchant: input.merchant,
    paymentIntentIdBytes32: input.paymentIntentIdBytes32,
    orderIdBytes32: input.orderIdBytes32,
    txAmount: input.amount.toString(),
    valueMatchesTxAmount: input.value === input.amount ? 'yes' : 'no',
    chainId: input.chainId?.toString() || '-',
    connectedWallet: input.connectedWallet || '-'
  };
}

function metricValue(value: number | null, invalid: boolean) {
  if (invalid) return '-';
  return value != null ? formatMUSD(value) : '-';
}

export function CustomerPayContent({ paymentIntentIdFromPath = '' }: { paymentIntentIdFromPath?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const publicClient = usePublicClient();
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectors, connectAsync, error: connectError } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { setOpen: setConnectModalOpen } = useModal();

  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState<number | null>(null);
  const [rawBalance, setRawBalance] = useState<bigint | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenConfigInvalid, setTokenConfigInvalid] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [paymentTxHash, setPaymentTxHash] = useState<`0x${string}` | undefined>();
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('permit');
  const [error, setError] = useState('');
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [nonce, setNonce] = useState<bigint | null>(null);
  const [tokenName, setTokenName] = useState<string>('MUSD Token');
  const [isPermitSupported, setIsPermitSupported] = useState(false);
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
  const injectedConnector = useMemo(() => (
    connectors.find((item) => item.type === 'injected' || /metaMask|injected/i.test(`${item.id} ${item.name}`))
  ), [connectors]);
  const walletConnectConnector = useMemo(() => (
    connectors.find((item) => /walletConnect|wallet connect/i.test(`${item.id} ${item.name}`))
  ), [connectors]);

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

      let contractMusdAddress: string;
      try {
        contractMusdAddress = String(await publicClient.readContract({
          address: paymentContract as `0x${string}`,
          abi: shoposPaymentAbi,
          functionName: 'musd'
        }));
        const musdAddressMatch = sameAddress(contractMusdAddress, musdAddress) ? 'yes' : 'no';
        setPartialDiagnostics({ contractMusdAddress, musdAddressMatch });
        if (musdAddressMatch !== 'yes') {
          const message = `MUSD address mismatch. Frontend resolved ${musdAddress}, but ShopOSPayment.musd() is ${contractMusdAddress}. Payment is blocked before wallet signing.`;
          setTokenConfigInvalid(true);
          failStep('checkShopOSPaymentMusd', message, { ...nextDiagnostics, contractMusdAddress, musdAddressMatch });
          logDebugFailure('checkShopOSPaymentMusd', {
            frontendMusdAddress: musdAddress,
            contractMusdAddress,
            paymentContract,
            chainId,
            functionName: 'musd',
            args: []
          }, new Error(message));
          return;
        }
        logDebugSuccess('checkShopOSPaymentMusd', contractMusdAddress);
      } catch (err: any) {
        const message = `ShopOSPayment.musd() read failed: ${getErrorMessage(err)}`;
        setTokenConfigInvalid(true);
        failStep('checkShopOSPaymentMusd', message, nextDiagnostics);
        logDebugFailure('checkShopOSPaymentMusd', { paymentContract, chainId, functionName: 'musd', args: [] }, err);
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

      // Try to read token name and nonces to check if Permit is supported
      try {
        const nameResult = await publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name'
        });
        setTokenName(String(nameResult || 'MUSD Token'));
        setPartialDiagnostics({
          permitDomainName: String(nameResult || 'MUSD Token'),
          permitDomainVersion: PERMIT_VERSION,
          permitDomainChainId: String(mezoTestnet.id),
          permitDomainVerifyingContract: musdAddress
        });

        const nonceResult = await publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'nonces',
          args: [address]
        });
        setNonce(nonceResult);
        setIsPermitSupported(true);
        console.log('[CustomerPayPermit] MUSD supports ERC-2612 Permit! Nonce:', nonceResult.toString());
      } catch (err) {
        console.log('[CustomerPayPermit] Token does not support Permit or nonces call failed:', err);
        setIsPermitSupported(false);
      }

      const enoughBalance = rawBalanceResult >= amountUnits;
      const enoughAllowance = rawAllowanceResult >= amountUnits;
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
    if (isPaymentConfirmed && (step === 'paying' || step === 'simulating' || step === 'confirming')) {
      setStep('confirmed');
    }
  }, [isPaymentConfirmed, step]);

  useEffect(() => {
    // Only fires after wagmi has confirmed the tx on-chain (isPaymentConfirmed = true).
    // At this point money has moved. We call submit-tx to trigger backend indexing,
    // but NEVER show 'Payment failed' based on its response — the tx is already mined.
    if (!isPaymentConfirmed || !paymentTxHash || !paymentIntentId) return;
    let cancelled = false;

    async function submitPaymentTx() {
      const successQuery = orderId.startsWith('pos_')
        ? new URLSearchParams({ status: 'paid', paymentIntentId, txHash: String(paymentTxHash) })
        : new URLSearchParams({ status: 'paid', orderId, txHash: String(paymentTxHash) });
      const successPath = orderId.startsWith('pos_')
        ? `/customer/order/${encodeURIComponent(orderId)}/pickup?${successQuery.toString()}`
        : `/customer/payment-success/${encodeURIComponent(paymentIntentId)}?${successQuery.toString()}`;

      try {
        const res = await fetch(`/api/payment-intents/${encodeURIComponent(paymentIntentId)}/submit-tx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash: paymentTxHash, paymentMode })
        });
        const data = await res.json();

        if (cancelled) return;

        if (data?.status === 'confirmed') {
          // Backend confirmed — navigate to success in the current app tab.
          router.push(successPath);
        } else if (data?.status === 'pending') {
          // Backend is still indexing (e.g. RPC propagation lag).
          // Goldsky webhook will confirm asynchronously. Stay on confirmed UI, no error.
          console.log('[submit-tx] Payment pending backend indexing — Goldsky webhook will confirm.', { txHash: paymentTxHash });
        } else {
          // Backend returned an error, but the tx IS confirmed on-chain.
          // Log it for debugging, then navigate to success anyway.
          console.error('[submit-tx] Backend indexing failed (tx confirmed on-chain):', {
            status: res.status,
            error: data?.error,
            txHash: paymentTxHash
          });
          router.push(successPath);
        }
      } catch (err: any) {
        if (cancelled) return;
        // Network error calling submit-tx — tx confirmed on-chain, navigate to success.
        console.error('[submit-tx] Network error (tx confirmed on-chain):', err?.message);
        router.push(successPath);
      }
    }

    submitPaymentTx();
    return () => {
      cancelled = true;
    };
  }, [isPaymentConfirmed, orderId, paymentIntentId, paymentMode, paymentTxHash, router]);

  // ─── Payment action — EIP-712 Permit only, no approve() ever called ───────────
  //
  // Flow:
  //   1. Click Pay → setStep('signing_permit')
  //   2. signTypedDataAsync → wallet shows "Signature request" (free, no gas)
  //   3. Extract v,r,s from signature → setStep('paying')
  //   4. writeContractAsync(payOrderWithPermit) → wallet shows "Transaction request"
  //   5. wagmi receipt hook fires → setStep('confirmed') → navigate to success
  //
  // The nonce is fetched fresh inside the function (not from stale React state)
  // so it always works even if loadTokenState() hasn't fully resolved yet.
  const payAndSign = async () => {
    setError('');
    setLastWriteError('');

    if (!requireWriteConnector()) return;
    if (missingEnv.length > 0) {
      setError(`Missing environment configuration: ${missingEnv.join(', ')}.`);
      return;
    }
    if (tokenConfigInvalid || tokenAddressConfigError) {
      setError(tokenDiagnostics.exactErrorMessage || tokenAddressConfigError || 'Token configuration error.');
      return;
    }
    if (!hasEnoughBalance) {
      setError('Insufficient MUSD balance.');
      return;
    }
    if (!address) {
      setError('Wallet address unavailable.');
      return;
    }

    try {
      if (!publicClient) {
        setError('Public client is unavailable.');
        setStep('failed');
        return;
      }

      // Step 0: Hard-block any token/payment contract mismatch before wallet signing.
      let contractMusdAddress: string;
      try {
        contractMusdAddress = String(await publicClient.readContract({
          address: paymentContract as `0x${string}`,
          abi: shoposPaymentAbi,
          functionName: 'musd'
        }));
        const musdAddressMatch = sameAddress(contractMusdAddress, musdAddress);
        setTokenDiagnostics((current) => ({
          ...current,
          contractMusdAddress,
          musdAddressMatch: musdAddressMatch ? 'yes' : 'no',
          lastFailedStep: musdAddressMatch ? current.lastFailedStep : 'checkShopOSPaymentMusd',
          exactErrorMessage: musdAddressMatch ? current.exactErrorMessage : `MUSD address mismatch. Frontend resolved ${musdAddress}, but ShopOSPayment.musd() is ${contractMusdAddress}. Payment is blocked before wallet signing.`
        }));
        if (!musdAddressMatch) {
          const message = `MUSD address mismatch. Frontend resolved ${musdAddress}, but ShopOSPayment.musd() is ${contractMusdAddress}. Payment is blocked before wallet signing.`;
          console.error('[PayAndSign] Blocking payment because ShopOSPayment.musd() does not match frontend MUSD address.', {
            frontendMusdAddress: musdAddress,
            contractMusdAddress,
            paymentContract,
            chainId,
            connectedWallet: address
          });
          setTokenConfigInvalid(true);
          setError(message);
          setStep('failed');
          return;
        }
      } catch (err: any) {
        const message = `ShopOSPayment.musd() read failed: ${getErrorMessage(err)}`;
        console.error('[PayAndSign] Unable to verify ShopOSPayment.musd() before signing.', {
          paymentContract,
          chainId,
          connectedWallet: address,
          ...serializeError(err)
        });
        setTokenConfigInvalid(true);
        setTokenDiagnostics((current) => ({
          ...current,
          lastFailedStep: 'checkShopOSPaymentMusd',
          exactErrorMessage: message
        }));
        setError(message);
        setStep('failed');
        return;
      }

      // Step 1: Fetch token name and nonce ALWAYS fresh from chain.
      // The EIP-712 domain name must match the token contract exactly.
      let currentTokenName: string;
      try {
        currentTokenName = String(await publicClient.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name'
        }));
        setTokenName(currentTokenName);
      } catch (err: any) {
        console.error('[PayAndSign] name() read failed:', err);
        setError(`MUSD token name() read failed: ${getErrorMessage(err)}`);
        setStep('failed');
        return;
      }

      // Step 2: Fetch nonce ALWAYS fresh from chain
      // Never rely on React state - a prior permit would have incremented it.
      let currentNonce: bigint;
      try {
        currentNonce = await publicClient!.readContract({
          address: musdAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'nonces',
          args: [address]
        });
        setNonce(currentNonce);
        console.log('[PayAndSign] Fresh nonce from chain:', currentNonce.toString());
      } catch (err) {
        console.error('[PayAndSign] nonces() read failed:', err);
        setError('MUSD token does not support EIP-2612 Permit on this network.');
        setStep('failed');
        return;
      }

      // Step 3: EIP-712 Permit signature
      // Wallet shows a 'Signature request' - NOT 'Spending cap request'.
      setStep('signing_permit');

      const amountWei = amountInUnits;
      const permitDeadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
      const dynamicPermitDomain = {
        name: currentTokenName,
        version: PERMIT_VERSION,
        chainId: mezoTestnet.id,
        verifyingContract: musdAddress as `0x${string}`
      } as const;

      const permitMessage = {
        owner:    address as `0x${string}`,
        spender:  paymentContract as `0x${string}`,
        value:    amountWei,
        nonce:    currentNonce,
        deadline: permitDeadline
      } as const;

      const corePermitDiagnostics = permitDiagnosticsPayload({
        owner: permitMessage.owner,
        spender: permitMessage.spender,
        value: permitMessage.value,
        nonce: permitMessage.nonce,
        deadline: permitMessage.deadline,
        domain: dynamicPermitDomain,
        musdAddress,
        contractMusdAddress,
        paymentContract,
        merchant,
        paymentIntentIdBytes32,
        orderIdBytes32,
        amount: amountWei,
        chainId,
        connectedWallet: address
      });

      setTokenDiagnostics((current) => ({
        ...current,
        contractMusdAddress,
        musdAddressMatch: 'yes',
        permitDomainName: dynamicPermitDomain.name,
        permitDomainVersion: dynamicPermitDomain.version,
        permitDomainChainId: String(dynamicPermitDomain.chainId),
        permitDomainVerifyingContract: dynamicPermitDomain.verifyingContract,
        permitOwner: permitMessage.owner,
        permitSpender: permitMessage.spender,
        permitValue: permitMessage.value.toString(),
        permitNonce: permitMessage.nonce.toString(),
        permitDeadline: permitMessage.deadline.toString(),
        permitSimulationStatus: '',
        permitSimulationError: '',
        lastFailedStep: '',
        exactErrorMessage: ''
      }));

      // Full debug dump BEFORE signing
      console.log('[PayAndSign] EIP-712 domain (must match contract EXACTLY):', {
        name:              dynamicPermitDomain.name,
        version:           dynamicPermitDomain.version,
        chainId:           dynamicPermitDomain.chainId,
        verifyingContract: dynamicPermitDomain.verifyingContract
      });
      console.log('[PayAndSign] Permit message and 12-point diagnostics:', corePermitDiagnostics);

      const signature = await signTypedDataAsync({
        domain:      dynamicPermitDomain,
        types:       permitTypes,
        primaryType: 'Permit',
        message:     permitMessage
      });


      // Full debug dump AFTER signing
      const r = signature.slice(0, 66) as `0x${string}`;
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
      const v = parseInt(signature.slice(130, 132), 16);

      console.log('[PayAndSign] Permit signature received:', {
        signature,
        r,
        s,
        v,
        signatureLength: signature.length
      });

      // Step 4: Simulate the exact contract call before asking the wallet to send a tx.
      // If permit() would revert, we stop here and show diagnostics instead of letting
      // the wallet fall back into an allowance/spending-cap flow.
      setStep('simulating');
      try {
        await publicClient.simulateContract({
          account: address as `0x${string}`,
          address: paymentContract as `0x${string}`,
          abi: shoposPaymentAbi,
          functionName: 'payOrderWithPermit',
          args: [
            paymentIntentIdBytes32 as `0x${string}`,
            orderIdBytes32 as `0x${string}`,
            merchant as `0x${string}`,
            amountWei,
            permitDeadline,
            v,
            r,
            s
          ]
        });
        setTokenDiagnostics((current) => ({
          ...current,
          permitSimulationStatus: 'pass',
          permitSimulationError: ''
        }));
        console.log('[PayAndSign] payOrderWithPermit simulation passed:', corePermitDiagnostics);
      } catch (err: any) {
        const message = `payOrderWithPermit simulation failed before wallet transaction: ${getErrorMessage(err)}`;
        const simulationDiagnostics = {
          ...corePermitDiagnostics,
          functionName: 'payOrderWithPermit',
          revertReason: getErrorMessage(err),
          serializedError: serializeError(err)
        };
        console.error('[PayAndSign] payOrderWithPermit simulation failed. Wallet transaction blocked.', simulationDiagnostics);
        setTokenDiagnostics((current) => ({
          ...current,
          permitSimulationStatus: 'fail',
          permitSimulationError: getErrorMessage(err),
          lastFailedStep: 'simulatePayOrderWithPermit',
          exactErrorMessage: message
        }));
        setError(message);
        setStep('failed');
        return;
      }

      // Step 5: Submit on-chain transaction
      // Single contract call: permit() + transferFrom() executed atomically.
      // Wallet shows 'Transaction request' - NOT a spending cap.
      setStep('paying');

      console.log('[PayAndSign] Submitting payOrderWithPermit tx:', {
        contract:            paymentContract,
        paymentIntentIdBytes32,
        orderIdBytes32,
        merchant,
        amount:              amountWei.toString(),
        deadline:            permitDeadline.toString(),
        v, r, s
      });

      const hash = await writeContractAsync({
        address: paymentContract as `0x${string}`,
        abi: shoposPaymentAbi,
        functionName: 'payOrderWithPermit',
        args: [
          paymentIntentIdBytes32 as `0x${string}`,
          orderIdBytes32 as `0x${string}`,
          merchant as `0x${string}`,
          amountWei,
          permitDeadline,
          v,
          r,
          s
        ]
      });

      setPaymentTxHash(hash);
      setStep('confirming');

      console.log('[PayAndSign] Transaction submitted:', { txHash: hash, paymentIntentId, orderId });
    } catch (err: any) {
      const isRejected = /rejected|denied|cancelled|user rejected/i.test(err?.message || '');
      const message = isRejected ? 'Payment cancelled by user.' : (err?.shortMessage || err?.message || 'Payment failed.');
      setLastWriteError(message);
      setError(message);
      setStep(isRejected ? 'idle' : 'failed');
    }
  };

  const payDirectTransfer = async () => {
    setError('');
    setLastWriteError('');

    if (!requireWriteConnector()) return;
    if (missingEnv.length > 0) {
      setError(`Missing environment configuration: ${missingEnv.join(', ')}.`);
      return;
    }
    if (tokenConfigInvalid || tokenAddressConfigError) {
      setError(tokenDiagnostics.exactErrorMessage || tokenAddressConfigError || 'Token configuration error.');
      return;
    }
    if (!hasEnoughBalance) {
      setError('Insufficient MUSD balance.');
      return;
    }
    if (!address) {
      setError('Wallet address unavailable.');
      return;
    }
    if (!publicClient) {
      setError('Public client is unavailable.');
      setStep('failed');
      return;
    }

    const amountWei = amountInUnits;
    const directDiagnostics = {
      mode: 'Mode 3 - Direct Transfer',
      token: musdAddress,
      from: address,
      to: merchant,
      amount: amountWei.toString(),
      amountMUSD: amount.toFixed(2),
      chainId,
      paymentIntentId,
      orderId
    };

    try {
      setStep('simulating');
      console.log('[DirectTransfer] Simulating MUSD.transfer fallback:', directDiagnostics);
      await publicClient.simulateContract({
        account: address as `0x${string}`,
        address: musdAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [merchant as `0x${string}`, amountWei]
      });

      setStep('paying');
      console.log('[DirectTransfer] Submitting MUSD.transfer fallback:', directDiagnostics);
      const hash = await writeContractAsync({
        address: musdAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [merchant as `0x${string}`, amountWei]
      });

      setPaymentTxHash(hash);
      setStep('confirming');
      console.log('[DirectTransfer] Transaction submitted:', { ...directDiagnostics, txHash: hash });
    } catch (err: any) {
      const isRejected = /rejected|denied|cancelled|user rejected/i.test(err?.message || '');
      const message = isRejected ? 'Payment cancelled by user.' : (err?.shortMessage || err?.message || 'Direct transfer payment failed.');
      console.error('[DirectTransfer] Fallback payment failed:', {
        ...directDiagnostics,
        ...serializeError(err)
      });
      setLastWriteError(message);
      setError(message);
      setStep(isRejected ? 'idle' : 'failed');
    }
  };

  const connectWallet = async (show?: () => void) => {
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

    try {
      if (typeof window !== 'undefined' && walletDebug.isMobile === 'yes' && walletDebug.hasWindowEthereum === 'no') {
        openMetaMaskDeepLink();
        return;
      }

      if (typeof window !== 'undefined' && (window as any).ethereum && injectedConnector) {
        await connectAsync({ connector: injectedConnector });
        return;
      }

      if (walletConnectConnector) {
        await connectAsync({ connector: walletConnectConnector });
        return;
      }
    } catch (err: any) {
      console.warn('[WalletConnectDebug] direct connect failed, opening selector', serializeError(err));
      setLastWriteError(err?.shortMessage || err?.message || 'Wallet connection failed.');
    }

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

  const openMetaMaskDeepLink = () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (!currentUrl || !currentUrl.startsWith('http')) {
      setError('Invalid payment page URL');
      throw new Error('Invalid payment page URL');
    }
    if (!paymentIntentId || !currentUrl.includes(paymentIntentId)) {
      setError('Invalid payment page URL');
      throw new Error('Invalid payment page URL');
    }
    const dappUrl = currentUrl.replace(/^https?:\/\//, '');
    const metamaskDeepLink = `metamask://dapp/${dappUrl}`;
    console.log('[MetaMask Deeplink] currentUrl:', currentUrl);
    console.log('[MetaMask Deeplink] paymentIntentId:', paymentIntentId);
    console.log('[MetaMask Deeplink] deepLink:', metamaskDeepLink);
    console.log('[WalletConnectDebug] open in MetaMask clicked', {
      isMobile: walletDebug.isMobile,
      hasWindowEthereum: walletDebug.hasWindowEthereum,
      deeplink: metamaskDeepLink,
      currentUrl
    });
    window.location.href = metamaskDeepLink;
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




  // payOrder() and payOrderWithPermit() replaced by unified payAndSign() above.

  const primaryAction = () => {
    if (step === 'signing_permit' || step === 'simulating' || step === 'paying' || step === 'confirming' || step === 'confirmed') return;
    if (!writeConnectorReady) {
      setError('Wallet is not connected. Please open this page in MetaMask or connect with WalletConnect.');
      return connectWallet();
    }
    if (isWrongNetwork) return switchToMezo();
    if (tokenConfigInvalid || tokenAddressConfigError || hasDiagnosticsError) return;
    if (!hasEnoughBalance) return;
    return paymentMode === 'direct_transfer' ? payDirectTransfer() : payAndSign();
  };

  const modeLabel = paymentMode === 'direct_transfer'
    ? 'Mode 3 Direct Transfer'
    : 'Mode 2 EIP-712 Permit';

  const primaryLabel = !writeConnectorReady
    ? '🔌 Connect Wallet'
    : isWrongNetwork
      ? 'Switch to Mezo Testnet'
      : tokenConfigInvalid || tokenAddressConfigError || hasDiagnosticsError
        ? 'Token Error — Run Diagnostics'
        : !hasEnoughBalance
          ? 'Insufficient MUSD Balance'
          : step === 'signing_permit'
            ? '✍️ Signing Permit...'
            : step === 'simulating'
              ? '🧪 Simulating Payment...'
            : step === 'paying'
              ? '⏳ Submitting Payment...'
              : step === 'confirming'
                ? '⏳ Confirming on Chain...'
                : step === 'confirmed'
                  ? '✅ Payment Confirmed'
                  : step === 'failed'
                    ? '⚡ Retry Payment'
                    : paymentMode === 'direct_transfer'
                      ? `Transfer & Pay ${formatMUSD(amount || 0)}`
                      : `⚡ Sign & Pay ${formatMUSD(amount || 0)}`;

  const disablePrimary =
    loadingBalances ||
    step === 'signing_permit' ||
    step === 'simulating' ||
    step === 'paying' ||
    step === 'confirming' ||
    step === 'confirmed' ||
    isPaymentConfirming ||
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
              
               {/* Payment Mode Indicator — always EIP-712 one-click */}
              {!isWrongNetwork && isConnected && !tokenConfigInvalid && !tokenAddressConfigError && !hasDiagnosticsError && (
                <div className={`mb-2 rounded-2xl p-3 text-sm font-bold ${paymentMode === 'direct_transfer' ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-700'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{paymentMode === 'direct_transfer' ? 'Mode 3 — Direct Transfer' : 'Mode 2 — EIP-712 Permit'}</p>
                      <p className={`mt-0.5 text-xs font-normal ${paymentMode === 'direct_transfer' ? 'text-sky-700' : 'text-emerald-600'}`}>
                        {paymentMode === 'direct_transfer'
                          ? 'Fallback mode sends MUSD directly to the merchant wallet. No spending-cap approval.'
                          : 'Sign a free off-chain permit, then submit one payment transaction.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${paymentMode === 'direct_transfer' ? 'bg-white text-sky-800' : 'bg-white text-emerald-800'}`}
                      onClick={() => {
                        setPaymentMode((current) => current === 'permit' ? 'direct_transfer' : 'permit');
                        setError('');
                        setLastWriteError('');
                        setStep('idle');
                      }}
                    >
                      {paymentMode === 'direct_transfer' ? 'Use Permit' : 'Use Direct'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wide opacity-80">
                    Current: {modeLabel}
                  </p>
                </div>
              )}

              {!writeConnectorReady ? (
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
                  {loadingBalances || step === 'signing_permit' || step === 'simulating' || step === 'paying' || step === 'confirming' || isPaymentConfirming ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 h-4 w-4" />
                  )}
                  {primaryLabel}
                </Button>
              ) : null}
              {!writeConnectorReady ? (
                <div className="mt-3 text-center">
                  <p className="text-xs font-bold text-slate-500">
                    If your wallet does not open, copy this link into your wallet browser.
                  </p>
                  <Button className="mt-2 h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={copyPaymentLink} type="button">
                    <Copy className="mr-2 h-4 w-4" />
                    {copiedPaymentLink ? 'Copied' : 'Copy Link'}
                  </Button>
                </div>
              ) : null}
              {isConnected ? (
                <Button
                  className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-slate-50"
                  disabled={loadingBalances}
                  onClick={loadTokenState}
                  type="button"
                >
                  {loadingBalances ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Run Token Diagnostics
                </Button>
              ) : null}
            </>
          )}
        </div>

        {paymentTxHash ? (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-950">Payment Transaction</p>
            <p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{paymentTxHash}</p>
            {step === 'paying' ? <StatusBox tone="warn" text="Submitting payment transaction to chain..." /> : null}
            {step === 'simulating' ? <StatusBox tone="warn" text="Simulating permit payment before opening the wallet transaction..." /> : null}
            {step === 'confirming' || isPaymentConfirming ? <StatusBox tone="warn" text="Waiting for blockchain confirmation..." /> : null}
            {step === 'confirmed' ? <StatusBox tone="success" text="Payment Confirmed ✔" /> : null}
            {(step === 'confirming' || step === 'confirmed' || isPaymentConfirming) ? (
              <p className="mt-3 text-xs font-bold text-slate-500">
                The POS will be confirmed automatically by the Goldsky webhook after the OrderPaid event is indexed.
              </p>
            ) : null}
          </div>
        ) : step === 'signing_permit' ? (
          <div className="rounded-3xl bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-black text-emerald-900">✍️ Permit Signature Pending</p>
            <p className="mt-1 text-xs font-bold text-emerald-700">
              Please check your wallet — a free off-chain signature request is waiting. This is not a transaction and costs no gas.
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
          <p className="text-sm font-black text-slate-950">Token Load Trace</p>
          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
            <TraceRow label="1. Wallet connected" status={isConnected ? 'pass' : 'pending'} detail={address || 'Not connected'} />
            <TraceRow label="2. Wallet chain" status={!isConnected ? 'pending' : isWrongNetwork ? 'fail' : 'pass'} detail={`current=${chainId || '-'}, expected=${mezoTestnet.id}`} />
            <TraceRow label="3. Address wiring" status={tokenAddressConfigError ? 'fail' : musdAddress ? 'pass' : 'fail'} detail={addressCollisionCheck || 'Missing MUSD token address'} />
            <TraceRow label="4. RPC chain" status={!tokenDiagnostics.rpcChainId ? 'pending' : tokenDiagnostics.rpcChainId === String(mezoTestnet.id) ? 'pass' : 'fail'} detail={`rpc=${tokenDiagnostics.rpcChainId || '-'}, expected=${mezoTestnet.id}`} />
            <TraceRow label="5. ShopOSPayment.musd()" status={tokenDiagnostics.musdAddressMatch === 'yes' ? 'pass' : tokenDiagnostics.musdAddressMatch === 'no' || tokenDiagnostics.lastFailedStep === 'checkShopOSPaymentMusd' ? 'fail' : 'pending'} detail={`contract=${tokenDiagnostics.contractMusdAddress || '-'}, frontend=${musdAddress || '-'}`} />
            <TraceRow label="6. Token bytecode" status={tokenDiagnostics.tokenBytecodePresent === 'yes' ? 'pass' : tokenDiagnostics.tokenBytecodePresent === 'no' ? 'fail' : 'pending'} detail={tokenDiagnostics.tokenBytecodePresent} />
            <TraceRow label="7. symbol()" status={tokenDiagnostics.symbolResult ? 'pass' : tokenDiagnostics.lastFailedStep === 'readSymbol' ? 'fail' : 'pending'} detail={tokenDiagnostics.symbolResult || '-'} />
            <TraceRow label="8. decimals()" status={tokenDiagnostics.decimalsResult ? 'pass' : tokenDiagnostics.lastFailedStep === 'readDecimals' ? 'fail' : 'pending'} detail={tokenDiagnostics.decimalsResult || '-'} />
            <TraceRow label="9. balanceOf(customer)" status={tokenDiagnostics.balanceRaw ? 'pass' : tokenDiagnostics.lastFailedStep === 'readBalance' ? 'fail' : 'pending'} detail={tokenDiagnostics.balanceFormatted || tokenDiagnostics.exactErrorMessage || '-'} />
            <TraceRow label="10. allowance(customer, ShopOSPayment)" status={tokenDiagnostics.allowanceRaw ? 'pass' : tokenDiagnostics.lastFailedStep === 'readAllowance' ? 'fail' : 'pending'} detail={tokenDiagnostics.allowanceFormatted || tokenDiagnostics.exactErrorMessage || '-'} />
            <TraceRow label="11. payOrderWithPermit simulation" status={tokenDiagnostics.permitSimulationStatus === 'pass' ? 'pass' : tokenDiagnostics.permitSimulationStatus === 'fail' ? 'fail' : 'pending'} detail={tokenDiagnostics.permitSimulationError || tokenDiagnostics.permitSimulationStatus || '-'} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">Diagnostics</p>
          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
            <DebugRow label="payment mode" value={modeLabel} />
            <DebugRow label="NEXT_PUBLIC_MUSD_TOKEN_ADDRESS" value={tokenDiagnostics.envMusdTokenAddress || envMusdTokenAddress || '-'} />
            <DebugRow label="NEXT_PUBLIC_SHOPOS_MUSD_TOKEN" value={tokenDiagnostics.envShoposMusdToken || envShoposMusdToken || '-'} />
            <DebugRow label="NEXT_PUBLIC_MUSD_ADDRESS" value={tokenDiagnostics.envMusdAddress || envMusdAddress || '-'} />
            <DebugRow label="NEXT_PUBLIC_MEZO_RPC_URL" value={tokenDiagnostics.envMezoRpcUrl || envMezoRpcUrl || '-'} />
            <DebugRow label="NEXT_PUBLIC_SEPOLIA_RPC_URL legacy" value={tokenDiagnostics.envLegacySepoliaRpcUrl || envLegacySepoliaRpcUrl || '-'} />
            <DebugRow label="resolved MUSD token address" value={tokenDiagnostics.musdAddress || musdAddress || '-'} />
            <DebugRow label="ShopOSPayment contract address" value={tokenDiagnostics.paymentContract || paymentContract || '-'} />
            <DebugRow label="ShopOSPayment.musd()" value={tokenDiagnostics.contractMusdAddress || '-'} />
            <DebugRow label="MUSD address match" value={tokenDiagnostics.musdAddressMatch || '-'} />
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
            <DebugRow label="permit domain name" value={tokenDiagnostics.permitDomainName || tokenName || '-'} />
            <DebugRow label="permit domain version" value={tokenDiagnostics.permitDomainVersion || PERMIT_VERSION} />
            <DebugRow label="permit domain chainId" value={tokenDiagnostics.permitDomainChainId || String(mezoTestnet.id)} />
            <DebugRow label="permit verifyingContract" value={tokenDiagnostics.permitDomainVerifyingContract || musdAddress || '-'} />
            <DebugRow label="permit owner" value={tokenDiagnostics.permitOwner || address || '-'} />
            <DebugRow label="permit spender" value={tokenDiagnostics.permitSpender || paymentContract || '-'} />
            <DebugRow label="permit value" value={tokenDiagnostics.permitValue || '-'} />
            <DebugRow label="permit nonce" value={tokenDiagnostics.permitNonce || nonce?.toString() || '-'} />
            <DebugRow label="permit deadline" value={tokenDiagnostics.permitDeadline || '-'} />
            <DebugRow label="permit simulation" value={tokenDiagnostics.permitSimulationStatus || '-'} />
            <DebugRow label="permit simulation error" value={tokenDiagnostics.permitSimulationError || '-'} />
            <DebugRow label="last failed step" value={tokenDiagnostics.lastFailedStep || '-'} />
            <DebugRow label="exact error message" value={tokenDiagnostics.exactErrorMessage || '-'} />
            <DebugRow label="payment method" value={paymentMode === 'direct_transfer' ? 'MUSD.transfer(merchant, amount) — direct fallback' : 'ShopOSPayment.payOrderWithPermit() — EIP-712 permit + transferFrom atomic'} />
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
