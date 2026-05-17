#!/usr/bin/env node

/**
 * MUSD Token Contract Diagnostic Script
 * 
 * This script verifies that the configured MUSD token address is correct
 * by calling ERC20 functions directly against the Mezo Testnet RPC.
 */

const fs = require('fs');
const path = require('path');
const { createPublicClient, http, defineChain } = require('viem');

// Load environment variables from .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  });
}

const MUSD_ADDRESS = process.env.NEXT_PUBLIC_MUSD_TOKEN_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.test.mezo.org';
const TEST_WALLET = '0x84eDc7907f22E6108C3fEd0f4be7633BD26AA134';

// Define Mezo Testnet chain
const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
    public: {
      http: [RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mezo Explorer',
      url: 'https://explorer.test.mezo.org/',
    },
  },
  testnet: true,
});

const erc20Abi = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
];

async function diagnose() {
  console.log('=== MUSD Token Contract Diagnostic ===\n');
  
  // Step 1: Check environment variable
  console.log('1. Environment Variable Check:');
  console.log(`   NEXT_PUBLIC_MUSD_TOKEN_ADDRESS: ${MUSD_ADDRESS || 'NOT SET'}`);
  console.log(`   NEXT_PUBLIC_SEPOLIA_RPC_URL: ${RPC_URL}\n`);
  
  if (!MUSD_ADDRESS) {
    console.error('❌ ERROR: NEXT_PUBLIC_MUSD_TOKEN_ADDRESS is not set!');
    console.error('   Please add it to your .env.local file:');
    console.error('   NEXT_PUBLIC_MUSD_TOKEN_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503\n');
    process.exit(1);
  }
  
  // Step 2: Validate address format
  console.log('2. Address Format Validation:');
  const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(MUSD_ADDRESS);
  console.log(`   Address: ${MUSD_ADDRESS}`);
  console.log(`   Valid EVM format: ${isValidFormat ? '✅ YES' : '❌ NO'}\n`);
  
  if (!isValidFormat) {
    console.error('❌ ERROR: Invalid EVM address format!\n');
    process.exit(1);
  }
  
  // Step 3: Create public client
  console.log('3. Creating Public Client:');
  const publicClient = createPublicClient({
    chain: mezoTestnet,
    transport: http(RPC_URL)
  });
  console.log(`   Chain ID: ${mezoTestnet.id}`);
  console.log(`   RPC URL: ${RPC_URL}\n`);
  
  // Step 4: Check for contract bytecode
  console.log('4. Contract Bytecode Check:');
  try {
    const code = await publicClient.getBytecode({
      address: MUSD_ADDRESS
    });
    
    if (!code || code === '0x') {
      console.error('❌ ERROR: No contract bytecode found at this address!');
      console.error('   This address does not contain a deployed contract.\n');
      process.exit(1);
    }
    
    console.log(`   ✅ Contract exists (bytecode length: ${code.length} chars)\n`);
  } catch (err) {
    console.error('❌ ERROR: Failed to check bytecode:', err.message);
    console.error('   Possible causes:');
    console.error('   - Wrong network/RPC URL');
    console.error('   - Network connectivity issues\n');
    process.exit(1);
  }
  
  // Step 5: Call ERC20 functions
  console.log('5. ERC20 Function Calls:');
  
  try {
    // decimals()
    console.log('   a) Calling decimals()...');
    const decimals = await publicClient.readContract({
      address: MUSD_ADDRESS,
      abi: erc20Abi,
      functionName: 'decimals'
    });
    console.log(`      ✅ decimals: ${decimals}\n`);
    
    // symbol()
    console.log('   b) Calling symbol()...');
    const symbol = await publicClient.readContract({
      address: MUSD_ADDRESS,
      abi: erc20Abi,
      functionName: 'symbol'
    });
    console.log(`      ✅ symbol: ${symbol}\n`);
    
    // balanceOf()
    console.log(`   c) Calling balanceOf(${TEST_WALLET})...`);
    const balance = await publicClient.readContract({
      address: MUSD_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [TEST_WALLET]
    });
    const balanceFormatted = Number(balance) / Math.pow(10, Number(decimals));
    console.log(`      ✅ balance: ${balanceFormatted.toFixed(2)} ${symbol}\n`);
    
  } catch (err) {
    console.error('❌ ERROR: ERC20 function call failed!');
    console.error(`   Error: ${err.shortMessage || err.message}`);
    console.error('\n   Possible causes:');
    console.error('   - Address is not an ERC20 token contract');
    console.error('   - Contract does not support standard ERC20 interface');
    console.error('   - Wrong network (contract deployed on different chain)');
    console.error('\n   Troubleshooting:');
    console.error('   1. Verify contract on Mezo Explorer: https://explorer.test.mezo.org/address/' + MUSD_ADDRESS);
    console.error('   2. Check if contract supports decimals(), symbol(), balanceOf()');
    console.error('   3. Ensure you are on Mezo Testnet (chainId: 31611)\n');
    process.exit(1);
  }
  
  // Step 6: Summary
  console.log('=== DIAGNOSIS COMPLETE ===\n');
  console.log('✅ SUCCESS: MUSD token contract is valid and accessible!');
  console.log('\nConfiguration Summary:');
  const finalSymbol = await publicClient.readContract({ address: MUSD_ADDRESS, abi: erc20Abi, functionName: 'symbol' });
  const finalDecimals = await publicClient.readContract({ address: MUSD_ADDRESS, abi: erc20Abi, functionName: 'decimals' });
  console.log(`   Token Address: ${MUSD_ADDRESS}`);
  console.log(`   Symbol: ${finalSymbol}`);
  console.log(`   Decimals: ${finalDecimals}`);
  console.log(`   Network: Mezo Testnet (chainId: ${mezoTestnet.id})`);
  console.log(`   RPC: ${RPC_URL}`);
  console.log('\nNext Steps:');
  console.log('   1. If you still see "Failed to load token information" in the browser:');
  console.log('      - Clear browser cache and hard reload (Cmd+Shift+R or Ctrl+Shift+R)');
  console.log('      - Restart the development server (npm run dev)');
  console.log('      - Check browser console for detailed error logs');
  console.log('   2. For Vercel deployment:');
  console.log('      - Update environment variables in Vercel Dashboard');
  console.log('      - Redeploy the application');
  console.log('      - Wait 1-2 minutes for deployment to complete\n');
}

diagnose().catch(err => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
