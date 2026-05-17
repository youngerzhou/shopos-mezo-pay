import { createPublicClient, createWalletClient, formatUnits, Hex, http, isAddress, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mezoTestnet, MUSD_ADDRESSES, SHOPOS_PULL_PAYMENT_CONTRACT } from '@/app/lib/mezo-config';

const MUSD_ADDRESS = MUSD_ADDRESSES.testnet;
const DEFAULT_MUSD_DECIMALS = 18;

// Token validation interface
export interface TokenValidationResult {
  isValid: boolean;
  decimals: number;
  symbol: string;
  errorMessage?: string;
}

// Comprehensive token validation function
export async function validateTokenContract(
  tokenAddress: string,
  chainId: number,
  walletAddress?: string
): Promise<TokenValidationResult> {
  // Validate address format
  if (!isAddress(tokenAddress)) {
    console.error('[TokenValidation] Invalid token address format:', {
      tokenAddress,
      chainId,
      walletAddress,
    });
    return {
      isValid: false,
      decimals: 0,
      symbol: 'UNKNOWN',
      errorMessage: 'Invalid token address format',
    };
  }

  try {
    const client = createPublicClient({
      chain: mezoTestnet,
      transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim()),
    });

    // Test decimals() function
    const decimals = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          name: 'decimals',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint8' }],
        },
      ],
      functionName: 'decimals',
    });

    // Test symbol() function
    const symbol = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          name: 'symbol',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'string' }],
        },
      ],
      functionName: 'symbol',
    });

    // If wallet address provided, test balanceOf()
    if (walletAddress) {
      await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
      });
    }

    console.log('[TokenValidation] Token contract validated successfully:', {
      tokenAddress,
      chainId,
      decimals,
      symbol,
      walletAddress,
    });

    return {
      isValid: true,
      decimals: Number(decimals),
      symbol: symbol as string,
    };
  } catch (error: any) {
    console.error('[TokenValidation] Token contract validation failed:', {
      tokenAddress,
      chainId,
      walletAddress,
      errorMessage: error?.message || 'Unknown error',
      errorDetails: error,
    });

    return {
      isValid: false,
      decimals: 0,
      symbol: 'UNKNOWN',
      errorMessage: error?.message || 'Invalid token contract configuration',
    };
  }
}

export const ALLOWANCE_TIERS = [
  { amount: 100, discount: 0.05, label: 'Silver' },
  { amount: 500, discount: 0.08, label: 'Gold' },
  { amount: 1000, discount: 0.10, label: 'Diamond' },
];

export function getTierForAllowance(allowanceInUnits: bigint) {
  const allowance = Number(allowanceInUnits) / 1e18;
  
  let currentTier = { amount: 0, discount: 0, label: 'Standard' };
  for (const tier of ALLOWANCE_TIERS) {
    if (allowance >= tier.amount) {
      currentTier = tier;
    }
  }
  return currentTier;
}

export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim())
});

const erc20DebugAbi = [
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
  }
] as const;

const pullPaymentDebugAbi = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'operators',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

function assertAddress(value: string, message: string): asserts value is `0x${string}` {
  if (!isAddress(value)) {
    throw new Error(message);
  }
}

function validateFastPayAddresses(customerAddress: string, recipientAddress?: string) {
  assertAddress(MUSD_ADDRESS, 'Invalid MUSD token address');
  assertAddress(SHOPOS_PULL_PAYMENT_CONTRACT, 'Invalid SHOPOS_PULL_PAYMENT_CONTRACT address');
  assertAddress(customerAddress, 'Invalid customer wallet address');

  if (recipientAddress !== undefined) {
    assertAddress(recipientAddress, 'Invalid recipient wallet address');
  }
}

async function getMusdDecimals(): Promise<number> {
  try {
    return Number(await publicClient.readContract({
      address: MUSD_ADDRESS as `0x${string}`,
      abi: erc20DebugAbi,
      functionName: 'decimals'
    }));
  } catch (err) {
    console.warn(`[Fast Pay Debug] Failed to read MUSD decimals. Falling back to ${DEFAULT_MUSD_DECIMALS}.`, err);
    return DEFAULT_MUSD_DECIMALS;
  }
}

async function logFastPayDebugSnapshot(params: {
  customerAddress: `0x${string}`;
  recipientAddress?: `0x${string}`;
  amountInUnits?: bigint;
  relayerAddress?: `0x${string}`;
  stage: string;
}) {
  const { customerAddress, recipientAddress, amountInUnits, relayerAddress, stage } = params;

  try {
    const decimals = await getMusdDecimals();
    const [allowance, customerBalance, merchantBalance, contractOwner, relayerIsOperator] = await Promise.all([
      publicClient.readContract({
        address: MUSD_ADDRESS as `0x${string}`,
        abi: erc20DebugAbi,
        functionName: 'allowance',
        args: [customerAddress, SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`]
      }) as Promise<bigint>,
      publicClient.readContract({
        address: MUSD_ADDRESS as `0x${string}`,
        abi: erc20DebugAbi,
        functionName: 'balanceOf',
        args: [customerAddress]
      }) as Promise<bigint>,
      recipientAddress
        ? publicClient.readContract({
            address: MUSD_ADDRESS as `0x${string}`,
            abi: erc20DebugAbi,
            functionName: 'balanceOf',
            args: [recipientAddress]
          }) as Promise<bigint>
        : Promise.resolve(null),
      publicClient.readContract({
        address: SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`,
        abi: pullPaymentDebugAbi,
        functionName: 'owner'
      }) as Promise<`0x${string}`>,
      relayerAddress
        ? publicClient.readContract({
            address: SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`,
            abi: pullPaymentDebugAbi,
            functionName: 'operators',
            args: [relayerAddress]
          }) as Promise<boolean>
        : Promise.resolve(null)
    ]);

    const relayerIsOwner = relayerAddress
      ? contractOwner.toLowerCase() === relayerAddress.toLowerCase()
      : null;

    console.log('[Fast Pay Debug]', {
      stage,
      chainId: mezoTestnet.id,
      musdAddress: MUSD_ADDRESS,
      pullPaymentContract: SHOPOS_PULL_PAYMENT_CONTRACT,
      customerAddress,
      recipientAddress,
      relayerAddress,
      tokenDecimals: decimals,
      allowanceRaw: allowance.toString(),
      allowanceMUSD: formatUnits(allowance, decimals),
      amountRaw: amountInUnits?.toString(),
      amountMUSD: amountInUnits === undefined ? undefined : formatUnits(amountInUnits, decimals),
      customerBalanceRaw: customerBalance.toString(),
      customerBalanceMUSD: formatUnits(customerBalance, decimals),
      merchantBalanceRaw: merchantBalance?.toString(),
      merchantBalanceMUSD: merchantBalance === null ? undefined : formatUnits(merchantBalance, decimals),
      contractOwner,
      relayerIsOwner,
      relayerIsOperator
    });
  } catch (err) {
    console.error('[Fast Pay Debug] Snapshot failed:', err);
  }
}

export async function getOnChainAllowance(customerAddress: string): Promise<bigint> {
  validateFastPayAddresses(customerAddress);

  try {
    const allowance = await publicClient.readContract({
      address: MUSD_ADDRESS as `0x${string}`,
      abi: erc20DebugAbi,
      functionName: 'allowance',
      args: [customerAddress as `0x${string}`, SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`]
    }) as bigint;
    return allowance;
  } catch (err) {
    console.error('Allowance fetch failed:', err);
    throw err;
  }
}

export async function checkFastPayAllowance(customerAddress: string, amount: number): Promise<boolean> {
  const allowance = await getOnChainAllowance(customerAddress);
  return Number(allowance) / 1e18 >= amount;
}

export async function executePullPayment(customerAddress: string, recipientAddress: string, amount: number): Promise<string | null> {
  validateFastPayAddresses(customerAddress, recipientAddress);

  const roundedAmount = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    throw new Error(`Invalid Fast Pay amount: ${amount}`);
  }

  const tokenDecimals = await getMusdDecimals();
  const amountInUnits = parseUnits(roundedAmount.toFixed(2), tokenDecimals);
  const allowance = await getOnChainAllowance(customerAddress);

  let relayerAddress: `0x${string}` | undefined;
  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY?.trim();
  if (relayerPrivateKey) {
    const normalizedPrivateKeyForDebug = relayerPrivateKey.startsWith('0x')
      ? relayerPrivateKey
      : `0x${relayerPrivateKey}`;

    if (/^0x[a-fA-F0-9]{64}$/.test(normalizedPrivateKeyForDebug)) {
      relayerAddress = privateKeyToAccount(normalizedPrivateKeyForDebug as Hex).address;
    }
  }

  await logFastPayDebugSnapshot({
    customerAddress: customerAddress as `0x${string}`,
    recipientAddress: recipientAddress as `0x${string}`,
    amountInUnits,
    relayerAddress,
    stage: 'before-pull-payment'
  });

  if (allowance < amountInUnits) {
    throw new Error(
      `Insufficient Fast Pay allowance for ${roundedAmount.toFixed(2)} MUSD. ` +
      `onChainAllowance=${formatUnits(allowance, tokenDecimals)} MUSD, ` +
      `spender=${SHOPOS_PULL_PAYMENT_CONTRACT}`
    );
  }

  if (!relayerPrivateKey) {
    throw new Error('RELAYER_PRIVATE_KEY is required to execute Fast Pay pull payments.');
  }

  const normalizedPrivateKey = relayerPrivateKey.startsWith('0x')
    ? relayerPrivateKey
    : `0x${relayerPrivateKey}`;

  if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedPrivateKey)) {
    throw new Error('RELAYER_PRIVATE_KEY must be a 32-byte hex private key.');
  }

  const account = privateKeyToAccount(normalizedPrivateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: mezoTestnet,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim())
  });

  const hash = await walletClient.writeContract({
    address: SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`,
    abi: [
      {
        name: 'pullPayment',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
      }
    ],
    functionName: 'pullPayment',
    args: [
      customerAddress as `0x${string}`,
      recipientAddress as `0x${string}`,
      amountInUnits
    ]
  });

  return hash;
}
