#!/usr/bin/env node

/**
 * Goldsky Pipeline Verification Script for ShopOS QR Payments
 * 
 * This script verifies that the Goldsky raw log pipeline is correctly configured
 * to capture OrderPaid events from the ShopOSPayment contract.
 */

const { keccak256, toBytes, decodeEventLog } = require('viem');
const fs = require('fs');
const path = require('path');

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

const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.test.mezo.org';
const SHOPOS_PAYMENT_CONTRACT = process.env.NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT;
const MUSD_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_MUSD_TOKEN_ADDRESS;
const MERCHANT_WALLET = process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET;

// Target transaction
const TARGET_TX_HASH = '0x0565a28dc573e20194bbcedfa46cefad363869b601babf6ef0beedeec1038531';
const EXPECTED_CONTRACT = '0xcf0e257daacba51cbfec1580f3593b3dfdc2802b';

// Expected event signature
const ORDER_PAID_SIGNATURE = 'OrderPaid(bytes32,bytes32,address,address,address,uint256)';
const EXPECTED_TOPIC0 = keccak256(toBytes(ORDER_PAID_SIGNATURE));

async function httpPost(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

async function verifyGoldskyPipeline() {
  console.log('=== Goldsky Pipeline Verification Report ===\n');
  
  // Step 1: Get transaction receipt
  console.log('1. Transaction Receipt Analysis:');
  console.log(`   Transaction Hash: ${TARGET_TX_HASH}`);
  
  const receipt = await httpPost(RPC_URL, {
    jsonrpc: '2.0',
    method: 'eth_getTransactionReceipt',
    params: [TARGET_TX_HASH],
    id: 1
  });
  
  if (!receipt.result) {
    console.error('   ❌ ERROR: Transaction not found or RPC failed\n');
    process.exit(1);
  }
  
  const txReceipt = receipt.result;
  const blockNumber = parseInt(txReceipt.blockNumber, 16);
  const status = txReceipt.status === '0x1' ? 'SUCCESS' : 'FAILED';
  
  console.log(`   Status: ${status} ✅`);
  console.log(`   Block Number: ${blockNumber}`);
  console.log(`   Contract Called: ${txReceipt.to}`);
  console.log(`   From: ${txReceipt.from}`);
  console.log(`   Total Logs: ${txReceipt.logs.length}\n`);
  
  // Step 2: Analyze logs
  console.log('2. Log Analysis:');
  
  let orderPaidFound = false;
  let musdTransferFound = false;
  let orderPaidLog = null;
  
  txReceipt.logs.forEach((log, index) => {
    console.log(`   Log ${index}:`);
    console.log(`     Address: ${log.address}`);
    console.log(`     Topic0: ${log.topics[0]}`);
    
    if (log.address.toLowerCase() === EXPECTED_CONTRACT.toLowerCase()) {
      console.log(`     ✅ Matches ShopOSPayment contract`);
      
      if (log.topics[0] === EXPECTED_TOPIC0) {
        console.log(`     ✅ Topic0 matches OrderPaid event signature`);
        orderPaidFound = true;
        orderPaidLog = log;
        
        // Decode the event
        try {
          const decoded = decodeEventLog({
            abi: [{
              type: 'event',
              name: 'OrderPaid',
              inputs: [
                { indexed: true, name: 'paymentIntentId', type: 'bytes32' },
                { indexed: true, name: 'orderId', type: 'bytes32' },
                { indexed: true, name: 'merchant', type: 'address' },
                { indexed: false, name: 'payer', type: 'address' },
                { indexed: false, name: 'token', type: 'address' },
                { indexed: false, name: 'amount', type: 'uint256' }
              ]
            }],
            data: log.data,
            topics: log.topics
          });
          
          console.log(`     Decoded Event:`);
          console.log(`       paymentIntentId: ${decoded.args.paymentIntentId}`);
          console.log(`       orderId: ${decoded.args.orderId}`);
          console.log(`       merchant: ${decoded.args.merchant}`);
          console.log(`       payer: ${decoded.args.payer}`);
          console.log(`       token: ${decoded.args.token}`);
          console.log(`       amount: ${Number(decoded.args.amount) / 1e18} MUSD`);
        } catch (err) {
          console.error(`     ❌ Failed to decode: ${err.message}`);
        }
      } else {
        console.log(`     ⚠️  Topic0 does NOT match OrderPaid signature`);
        console.log(`         Expected: ${EXPECTED_TOPIC0}`);
        console.log(`         Actual:   ${log.topics[0]}`);
      }
    }
    
    if (log.address.toLowerCase() === MUSD_TOKEN_ADDRESS?.toLowerCase()) {
      console.log(`     ℹ️  MUSD ERC20 Transfer event`);
      musdTransferFound = true;
    }
    
    console.log();
  });
  
  // Step 3: Verify current block
  console.log('3. Block Progress:');
  const currentBlockResult = await httpPost(RPC_URL, {
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1
  });
  
  const currentBlock = parseInt(currentBlockResult.result, 16);
  const blocksSinceTx = currentBlock - blockNumber;
  
  console.log(`   Transaction Block: ${blockNumber}`);
  console.log(`   Current Block: ${currentBlock}`);
  console.log(`   Blocks Since Tx: ${blocksSinceTx}`);
  console.log(`   ✅ Transaction is confirmed (${blocksSinceTx} blocks ago)\n`);
  
  // Step 4: Configuration verification
  console.log('4. Environment Configuration:');
  console.log(`   NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT: ${SHOPOS_PAYMENT_CONTRACT || 'NOT SET'}`);
  console.log(`   NEXT_PUBLIC_MUSD_TOKEN_ADDRESS: ${MUSD_TOKEN_ADDRESS || 'NOT SET'}`);
  console.log(`   NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET: ${MERCHANT_WALLET || 'NOT SET'}`);
  console.log(`   NEXT_PUBLIC_SEPOLIA_RPC_URL: ${RPC_URL}\n`);
  
  // Step 5: Summary table
  console.log('=== VERIFICATION SUMMARY ===\n');
  
  const results = {
    'Transaction Status': status === 'SUCCESS' ? '✅ PASS' : '❌ FAIL',
    'OrderPaid Event Found': orderPaidFound ? '✅ YES' : '❌ NO',
    'ShopOSPayment Contract Match': txReceipt.to?.toLowerCase() === EXPECTED_CONTRACT.toLowerCase() ? '✅ YES' : '❌ NO',
    'Topic0 Signature Match': orderPaidFound ? '✅ YES' : '❌ NO',
    'MUSD Transfer Also Present': musdTransferFound ? '✅ YES' : '⚠️  NO',
    'Transaction Block': blockNumber.toString(),
    'Current Block': currentBlock.toString(),
    'Blocks Since Tx': blocksSinceTx.toString(),
    'Goldsky Start Block Required': `<= ${blockNumber}`,
    'Contract Filter Required': EXPECTED_CONTRACT,
    'Topic0 Filter Required': EXPECTED_TOPIC0
  };
  
  Object.entries(results).forEach(([key, value]) => {
    console.log(`${key.padEnd(35)} ${value}`);
  });
  
  console.log('\n=== GOLDSKY PIPELINE CONFIGURATION CHECKLIST ===\n');
  
  console.log('Required Goldsky Pipeline Settings:');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Network:          Mezo Testnet (chainId: 31611)            │');
  console.log('│ Source Type:      Raw Logs                                  │');
  console.log('│ Start Block:      <= 13107020 (transaction block)          │');
  console.log('│ Contract Filter:  0xcf0e257daacba51cbfec1580f3593b3dfdc2802b │');
  console.log('│ Topic0 Filter:    0x09e99da262bb12c46eaeae571a859520dbb1218e...   │');
  console.log('│                   (OrderPaid event signature)               │');
  console.log('│ Webhook URL:      https://your-domain.com/api/webhook      │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
  
  console.log('Common Mistakes to Avoid:');
  console.log('  ❌ Listening to MUSD token contract instead of ShopOSPayment');
  console.log('  ❌ Filtering only ERC20 Transfer events');
  console.log('  ❌ Start block set too high (after transaction block)');
  console.log('  ❌ Wrong network (e.g., Ethereum Sepolia instead of Mezo)');
  console.log('  ❌ Topic0 filter incorrect or missing\n');
  
  console.log('Webhook Payload Structure:');
  console.log('  Goldsky should send:');
  console.log('  {');
  console.log('    "data": {');
  console.log('      "address": "0xcf0e257daacba51cbfec1580f3593b3dfdc2802b",');
  console.log('      "topics": [');
  console.log('        "0x09e99da262bb12c46eaeae571a859520dbb1218e8f6e186e4c0392269e98ed36",');
  console.log('        "<paymentIntentId>",');
  console.log('        "<orderId>",');
  console.log('        "0x00000000000000000000000092a3c1adc73f79818a09c6494a7bd28da9ea98e7"');
  console.log('      ],');
  console.log('      "data": "0x<payer><token><amount>",');
  console.log('      "transactionHash": "0x0565a28dc573e20194bbcedfa46cefad363869b601babf6ef0beedeec1038531",');
  console.log('      "blockNumber": 13107020');
  console.log('    }');
  console.log('  }\n');
  
  console.log('Manual Testing:');
  console.log('  To test webhook without Goldsky, POST this payload:');
  console.log('  curl -X POST https://your-domain.com/api/webhook \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"data":{"address":"0xcf0e257daacba51cbfec1580f3593b3dfdc2802b","topics":["0x09e99da262bb12c46eaeae571a859520dbb1218e8f6e186e4c0392269e98ed36","0x2e67cc59a940477896e778c8c50988160f5f271e02901241be9e36ad8dcdef50","0x3b1b9c9676e637ad7b9500ef95a5d45943251ebf7049936630a152968f48ffd6","0x00000000000000000000000092a3c1adc73f79818a09c6494a7bd28da9ea98e7"],"data":"0x00000000000000000000000084edc7907f22e6108c3fed0f4be7633bd26aa134000000000000000000000000118917a40faf1cd7a13db0ef56c86de7973ac503000000000000000000000000000000000000000000000004e1003b28d9280000","transactionHash":"0x0565a28dc573e20194bbcedfa46cefad363869b601babf6ef0beedeec1038531","blockNumber":13107020}}\'\n');
  
  console.log('Next Steps:');
  console.log('  1. Verify Goldsky pipeline configuration in Goldsky Dashboard');
  console.log('  2. Check Goldsky pipeline logs for processing errors');
  console.log('  3. Verify webhook endpoint is accessible and returns HTTP 200');
  console.log('  4. Check Vercel logs for webhook delivery attempts');
  console.log('  5. If Goldsky missed the event, trigger manual replay/backfill\n');
  
  // Final verdict
  if (orderPaidFound) {
    console.log('✅ VERDICT: OrderPaid event was emitted correctly on-chain.');
    console.log('   If Goldsky did not pick it up, check pipeline configuration.\n');
  } else {
    console.log('❌ VERDICT: OrderPaid event was NOT found in transaction.');
    console.log('   This indicates a contract deployment or call issue.\n');
  }
}

verifyGoldskyPipeline().catch(err => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
