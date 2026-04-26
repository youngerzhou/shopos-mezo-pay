'use client';

import React, { useEffect, useState } from 'react';
import { 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useAccount,
  useConnect,
  useSwitchChain
} from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, Wallet } from 'lucide-react';
import { mezoTestnet } from '@/components/Web3Provider';
import { useToast } from '@/hooks/use-toast';

// Standard ERC20 ABI (transfer subset)
const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// PLACEHOLDER: Update with real MUSD contract on Mezo Testnet
const MUSD_ADDRESS = '0x5Ab8E1C2A31a54728590c7E86749A50a6E1e450b'; 

interface ContractInteractionProps {
  orderId: string;
  amount: number;
  merchantAddress: string;
  onSuccess: (hash: string) => void;
  onError: (error: string) => void;
}

export function ContractInteraction({ 
  orderId, 
  amount, 
  merchantAddress, 
  onSuccess, 
  onError 
}: ContractInteractionProps) {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  
  const { 
    writeContract, 
    data: hash, 
    isPending, 
    error: writeError 
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash,
  });

  const handlePayment = async () => {
    if (!isConnected) {
      const injected = connectors.find(c => c.id === 'injected');
      if (injected) connect({ connector: injected });
      return;
    }

    try {
      // Ensure we are on Mezo Testnet
      await switchChain({ chainId: mezoTestnet.id });

      // amount is in MUSD (assuming 18 decimals)
      const amountInUnits = parseUnits(amount.toString(), 18);

      writeContract({
        address: MUSD_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [merchantAddress as `0x${string}`, amountInUnits],
      });
    } catch (err: any) {
      onError(err.message);
    }
  };

  useEffect(() => {
    if (isConfirmed && hash) {
      onSuccess(hash);
    }
  }, [isConfirmed, hash, onSuccess]);

  useEffect(() => {
    if (writeError) {
      onError(writeError.message);
    }
  }, [writeError, onError]);

  return (
    <div className="space-y-4">
      {!isConnected ? (
        <Button 
          className="w-full rounded-2xl h-14 font-black gap-2 bg-primary text-secondary shadow-lg hover:scale-[1.02] transition-transform"
          onClick={() => {
            const injected = connectors.find(c => c.id === 'injected');
            if (injected) connect({ connector: injected });
          }}
        >
          <Wallet className="w-5 h-5" />
          Connect Mezo Wallet
        </Button>
      ) : (
        <Button 
          disabled={isPending || isConfirming || isConfirmed}
          className="w-full rounded-2xl h-14 font-black gap-2 bg-secondary text-primary shadow-lg hover:shadow-secondary/20 hover:scale-[1.02] transition-transform disabled:opacity-50"
          onClick={handlePayment}
        >
          {isPending || isConfirming ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              {isPending ? 'Requesting Approval...' : 'Confirming on Mezo...'}
            </>
          ) : isConfirmed ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Transfer Successful
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Pay {amount.toFixed(2)} MUSD
            </>
          )}
        </Button>
      )}

      {(writeError) && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-[10px] font-bold text-red-600 leading-tight">
            {writeError.message.includes('rejected') ? 'User rejected the request.' : 'Transaction failed. Check balance.'}
          </p>
        </div>
      )}
    </div>
  );
}
