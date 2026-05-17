#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { createPublicClient, createWalletClient, defineChain, getAddress, http, keccak256, toBytes } = require('viem');
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

function optionalEnv(primaryName, fallbackName) {
  return process.env[primaryName]?.trim() || process.env[fallbackName]?.trim();
}

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function normalizePrivateKey(value) {
  const key = value.startsWith('0x') ? value : `0x${value}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error('RELAYER_PRIVATE_KEY must be a 32-byte hex private key');
  }
  return key;
}

function compileContract() {
  const contractPath = path.join(process.cwd(), 'contracts', 'ShopOSPayment.sol');
  const source = fs.readFileSync(contractPath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'ShopOSPayment.sol': { content: source },
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

  const contract = output.contracts['ShopOSPayment.sol'].ShopOSPayment;
  const artifact = {
    contractName: 'ShopOSPayment',
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
  const artifactDir = path.join(process.cwd(), 'artifacts', 'contracts', 'ShopOSPayment.sol');
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, 'ShopOSPayment.json'), JSON.stringify(artifact, null, 2));

  return artifact;
}

async function main() {
  loadLocalEnv();

  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || 'https://rpc.test.mezo.org/';
  const musdAddress = getAddress(optionalEnv('MUSD_TOKEN_ADDRESS', 'NEXT_PUBLIC_MUSD_ADDRESS') || requireEnv('MUSD_TOKEN_ADDRESS'));
  const merchantWallet = getAddress(firstEnv([
    'SHOPOS_MERCHANT_WALLET',
    'NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET'
  ]) || '0x92a3C1AdC73F79818a09C6494a7bd28da9ea98E7');
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
  const eventSignature = 'OrderPaid(bytes32,bytes32,address,address,address,uint256)';
  const eventTopic = keccak256(toBytes(eventSignature));

  console.log('Deploying ShopOSPayment...');
  console.log(`Network: ${mezoTestnet.name} (${mezoTestnet.id})`);
  console.log(`MUSD token address: ${musdAddress}`);
  console.log(`Merchant wallet: ${merchantWallet}`);
  console.log(`Deployer: ${account.address}`);

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

  console.log(`ShopOSPayment contract address: ${receipt.contractAddress}`);
  console.log(`MUSD token address: ${musdAddress}`);
  console.log(`Merchant wallet: ${merchantWallet}`);
  console.log(`OrderPaid event signature: ${eventSignature}`);
  console.log(`OrderPaid event topic: ${eventTopic}`);
  console.log('ABI artifact: artifacts/contracts/ShopOSPayment.sol/ShopOSPayment.json');
  console.log('\nAdd these values to Vercel:');
  console.log(`NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT=${receipt.contractAddress}`);
  console.log(`SHOPOS_PAYMENT_CONTRACT_ADDRESS=${receipt.contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
