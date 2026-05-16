#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { createPublicClient, createWalletClient, defineChain, getAddress, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizePrivateKey(value) {
  const key = value.startsWith('0x') ? value : `0x${value}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error('RELAYER_PRIVATE_KEY must be a 32-byte hex private key');
  }
  return key;
}

function compileContract() {
  const contractPath = path.join(process.cwd(), 'contracts', 'ShoposPullPayment.sol');
  const source = fs.readFileSync(contractPath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'ShoposPullPayment.sol': { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors || [];
  const fatalErrors = errors.filter((error) => error.severity === 'error');
  for (const error of errors) {
    console.error(error.formattedMessage.trim());
  }
  if (fatalErrors.length > 0) {
    throw new Error('Solidity compilation failed');
  }

  const contract = output.contracts['ShoposPullPayment.sol'].ShoposPullPayment;
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

async function main() {
  loadLocalEnv();

  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || 'https://rpc.test.mezo.org/';
  const musdAddress = getAddress(requireEnv('NEXT_PUBLIC_MUSD_ADDRESS'));
  const relayerPrivateKey = normalizePrivateKey(requireEnv('RELAYER_PRIVATE_KEY'));
  const account = privateKeyToAccount(relayerPrivateKey);

  const mezoTestnet = defineChain({
    id: 31611,
    name: 'Mezo Testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  });

  const { abi, bytecode } = compileContract();
  const publicClient = createPublicClient({ chain: mezoTestnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: mezoTestnet, transport: http(rpcUrl) });

  console.log('Deploying ShoposPullPayment...');
  console.log(`Network: ${mezoTestnet.name} (${mezoTestnet.id})`);
  console.log(`MUSD: ${musdAddress}`);
  console.log(`Owner/operator: ${account.address}`);

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [musdAddress],
  });

  console.log(`Deployment tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error('Deployment receipt did not include a contract address');
  }

  console.log(`ShoposPullPayment deployed: ${receipt.contractAddress}`);
  console.log('\nAdd these values to .env.local:');
  console.log(`NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT=${receipt.contractAddress}`);
  console.log(`RELAYER_PRIVATE_KEY=<same operator private key used by the backend>`);
  console.log(`NEXT_PUBLIC_MUSD_ADDRESS=${musdAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
