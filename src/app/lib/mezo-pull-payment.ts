import { createPublicClient, createWalletClient, Hex, http, isAddress, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mezoTestnet, MUSD_ADDRESSES, SHOPOS_PULL_PAYMENT_CONTRACT } from '@/app/lib/mezo-config';

const MUSD_ADDRESS = MUSD_ADDRESSES.testnet;

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
  transport: http()
});

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

export async function getOnChainAllowance(customerAddress: string): Promise<bigint> {
  validateFastPayAddresses(customerAddress);

  try {
    const allowance = await publicClient.readContract({
      address: MUSD_ADDRESS,
      abi: [
        {
          name: 'allowance',
          type: 'function',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ name: '', type: 'uint256' }]
        }
      ],
      functionName: 'allowance',
      args: [customerAddress, SHOPOS_PULL_PAYMENT_CONTRACT]
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

  const amountInUnits = parseUnits(roundedAmount.toFixed(2), 18);
  const allowance = await getOnChainAllowance(customerAddress);
  if (allowance < amountInUnits) {
    throw new Error(`Insufficient Fast Pay allowance for ${roundedAmount.toFixed(2)} MUSD.`);
  }

  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY?.trim();
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
    transport: http()
  });

  const hash = await walletClient.writeContract({
    address: SHOPOS_PULL_PAYMENT_CONTRACT,
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
      customerAddress,
      recipientAddress,
      amountInUnits
    ]
  });

  return hash;
}
