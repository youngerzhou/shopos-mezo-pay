import { createPublicClient, http } from 'viem';
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

export async function getOnChainAllowance(customerAddress: string): Promise<bigint> {
  try {
    const allowance = await publicClient.readContract({
      address: MUSD_ADDRESS as `0x${string}`,
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
      args: [customerAddress as `0x${string}`, SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`]
    }) as bigint;
    return allowance;
  } catch (err) {
    console.error('Allowance fetch failed:', err);
    return 0n;
  }
}

export async function checkFastPayAllowance(customerAddress: string, amount: number): Promise<boolean> {
  const allowance = await getOnChainAllowance(customerAddress);
  return Number(allowance) / 1e18 >= amount;
}

export async function executePullPayment(customerAddress: string, recipientAddress: string, amount: number): Promise<string | null> {
  // Logic for pull payment execution
  console.log('Executing pull payment from', customerAddress, 'to', recipientAddress, 'amount', amount);
  return '0x_mock_hash';
}
