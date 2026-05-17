#!/usr/bin/env node

const assert = require('assert');
const { decodeAbiParameters, decodeEventLog, formatUnits, getAddress, hexToString, parseAbiItem, padHex, stringToHex } = require('viem');

const ORDER_PAID_TOPIC0 = '0x09e99da262bb12c46eaeae571a859520dbb1218e8f6e186e4c0392269e98ed36';
const SAMPLE_PAYMENT_REF = 'PI_8A12E45700DD40FE';
const SAMPLE_ORDER_ID = 'ORD_1234567890ABCDEF';
const SAMPLE_PAYMENT_REF_BYTES32 = padHex(stringToHex(SAMPLE_PAYMENT_REF), { size: 32, dir: 'right' });
const SAMPLE_ORDER_ID_BYTES32 = padHex(stringToHex(SAMPLE_ORDER_ID), { size: 32, dir: 'right' });
const SAMPLE_TOPICS = [
  ORDER_PAID_TOPIC0,
  SAMPLE_PAYMENT_REF_BYTES32,
  SAMPLE_ORDER_ID_BYTES32,
  '0x00000000000000000000000092a3c1adc73f79818a09c6494a7bd28da9ea98e7'
];
const SAMPLE_DATA = '0x00000000000000000000000084edc7907f22e6108c3fed0f4be7633bd26aa134000000000000000000000000118917a40faf1cd7a13db0ef56c86de7973ac503000000000000000000000000000000000000000000000004e1003b28d9280000';

const ORDER_PAID_EVENT = parseAbiItem(
  'event OrderPaid(bytes32 indexed paymentIntentId, bytes32 indexed orderId, address indexed merchant, address payer, address token, uint256 amount)'
);

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function normalizeTopics(value) {
  if (Array.isArray(value)) return value.map((topic) => String(topic).trim()).filter(Boolean);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('[')) return JSON.parse(trimmed).map((topic) => String(topic).trim()).filter(Boolean);
  return trimmed.replace(/^\{|\}$/g, '').split(',').map((topic) => topic.trim().replace(/^"|"$/g, '')).filter(Boolean);
}

function getTopicsFromRawLog(event) {
  const topics = normalizeTopics(event?.topics || event?.log?.topics);
  if (topics?.length) return topics;
  return [
    pick(event, ['topic0', 'topic_0']),
    pick(event, ['topic1', 'topic_1']),
    pick(event, ['topic2', 'topic_2']),
    pick(event, ['topic3', 'topic_3'])
  ].filter(Boolean).map(String);
}

function topicToAddress(topic) {
  return getAddress(`0x${topic.slice(-40)}`);
}

function fromBytes32String(value) {
  return hexToString(value, { size: 32 }).replace(/\0+$/g, '');
}

function decodeSample(event) {
  const topics = getTopicsFromRawLog(event);
  const data = pick(event, ['data', 'logData', 'log_data']);

  try {
    const decoded = decodeEventLog({ abi: [ORDER_PAID_EVENT], topics, data });
    return {
      paymentIntentId: fromBytes32String(decoded.args.paymentIntentId),
      orderId: fromBytes32String(decoded.args.orderId),
      merchant: decoded.args.merchant,
      payer: decoded.args.payer,
      token: decoded.args.token,
      amountMUSD: formatUnits(decoded.args.amount, 18)
    };
  } catch {
    const [payer, token, amount] = decodeAbiParameters(
      [
        { name: 'payer', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      data
    );
    return {
      paymentIntentId: fromBytes32String(topics[1]),
      orderId: fromBytes32String(topics[2]),
      merchant: topicToAddress(topics[3]),
      payer,
      token,
      amountMUSD: formatUnits(amount, 18)
    };
  }
}

const sampleRows = [
  {
    name: 'topics array',
    row: {
      address: '0xcf0e257daacba51cbfec1580f3593b3dfdc2802b',
      topics: SAMPLE_TOPICS,
      data: SAMPLE_DATA,
      transaction_hash: '0x0565a28dc573e20194bbcedfa46cefad363869b601babf6ef0beedeec1038531',
      block_number: 13107020,
      log_index: 1
    }
  },
  {
    name: 'topics comma string',
    row: {
      contract_address: '0xcf0e257daacba51cbfec1580f3593b3dfdc2802b',
      topics: SAMPLE_TOPICS.join(','),
      data: SAMPLE_DATA,
      transactionHash: '0x0565a28dc573e20194bbcedfa46cefad363869b601babf6ef0beedeec1038531',
      blockNumber: 13107020,
      logIndex: 1
    }
  },
  {
    name: 'topic0-topic3 columns',
    row: {
      address: '0xcf0e257daacba51cbfec1580f3593b3dfdc2802b',
      topic0: SAMPLE_TOPICS[0],
      topic1: SAMPLE_TOPICS[1],
      topic2: SAMPLE_TOPICS[2],
      topic3: SAMPLE_TOPICS[3],
      data: SAMPLE_DATA,
      tx_hash: '0x0565a28dc573e20194bbcedfa46cefad363869b601babf6ef0beedeec1038531'
    }
  }
];

for (const { name, row } of sampleRows) {
  const decoded = decodeSample(row);
  assert.strictEqual(decoded.paymentIntentId, SAMPLE_PAYMENT_REF, `${name}: paymentIntentId`);
  assert.strictEqual(decoded.orderId, SAMPLE_ORDER_ID, `${name}: orderId`);
  assert.strictEqual(decoded.merchant, '0x92a3C1AdC73F79818a09C6494a7bd28da9ea98E7', `${name}: merchant`);
  assert.strictEqual(decoded.payer, '0x84eDc7907f22E6108C3fEd0f4be7633BD26AA134', `${name}: payer`);
  assert.strictEqual(decoded.token, '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503', `${name}: token`);
  assert.strictEqual(decoded.amountMUSD, '90', `${name}: amount`);
  console.log(`PASS ${name}`, decoded);
}
