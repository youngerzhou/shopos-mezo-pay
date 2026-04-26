import { createPublicClient, createWalletClient, http, parseUnits, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// PLACEHOLDERS: These should be in environment variables
const MEZO_RPC_URL = 'https://rpc.test.mezo.org'; 
const MUSD_ADDRESS = '0x5Ab8E1C2A31a54728590c7E86749A50a6E1e450b';
const SHOPOS_PULL_PAYMENT_CONTRACT = '0x489622dCC88cc10787A9A9A9A9A9A9A9A9A9A9A9';

// Relayer Private Key (Used to trigger pull payment)
// In a real app, this is stored in a Vault
const RELAYER_PVKEY = process.env.RELAYER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';

const publicClient = createPublicClient({
  transport: http(MEZO_RPC_URL)
});

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

    const amountInUnits = parseUnits(amount.toString(), 18);
    return allowance >= amountInUnits;
  } catch (err) {
    console.error('Allowance check failed:', err);
    return false;
  }
}

export async function executePullPayment(customerAddress: string, merchantAddress: string, amount: number): Promise<string | null> {
  if (RELAYER_PVKEY === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.warn('[Fast Pay] No Relayer Private Key found. Simulating transaction...');
    return `SIM_TX_${Math.random().toString(36).substring(7)}`;
  }

  try {
    const account = privateKeyToAccount(RELAYER_PVKEY as Hex);
    const walletClient = createWalletClient({
      account,
      transport: http(MEZO_RPC_URL)
    });

    const amountInUnits = parseUnits(amount.toString(), 18);

    // This calls the ShopOS contract which has permission to pull via transferFrom
    const hash = await walletClient.writeContract({
      address: SHOPOS_PULL_PAYMENT_CONTRACT as `0x${string}`,
      abi: [
        {
          name: 'pullPayment',
          type: 'function',
          inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }]
        }
      ],
      functionName: 'pullPayment',
      args: [customerAddress as `0x${string}`, merchantAddress as `0x${string}`, amountInUnits]
    });

    return hash;
  } catch (err) {
    console.error('Pull payment execution failed:', err);
    return null;
  }
}
