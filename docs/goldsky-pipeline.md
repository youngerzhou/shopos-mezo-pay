# Goldsky Pipeline for ShopOSPayment

This pipeline listens for `ShopOSPayment.OrderPaid` events on Mezo Testnet and posts them to the ShopOS webhook.

## Recommended Datasets

- Raw Logs
- Enriched Transactions

Use Raw Logs for contract event fidelity. Enriched Transactions are useful for debugging transaction-level metadata.

## Contract and Event

Listen to the deployed `ShopOSPayment` contract only.

Event:

```solidity
event OrderPaid(
  bytes32 indexed paymentIntentId,
  bytes32 indexed orderId,
  address indexed merchant,
  address payer,
  address token,
  uint256 amount
);
```

Event signature:

```text
OrderPaid(bytes32,bytes32,address,address,address,uint256)
```

Webhook URL:

```text
https://shopos-mezo-pay.vercel.app/api/webhook
```

## Example Pipeline YAML

Replace `${SHOPOS_PAYMENT_CONTRACT_ADDRESS}` with the deployed `ShopOSPayment` address.

```yaml
name: shopos-payment-order-paid
resource_size: s
apiVersion: 3
sources:
  shopos_order_paid:
    type: dataset
    dataset_name: mezo-testnet.raw_logs
    version: 1.0.0
    start_at: latest
    filter: |
      address = lower('${SHOPOS_PAYMENT_CONTRACT_ADDRESS}')
      and topic0 = lower('0x09e99da262bb12c46eaeae571a859520dbb1218e8f6e186e4c0392269e98ed36')
transforms:
  decode_order_paid:
    sql: |
      select
        transaction_hash,
        block_number,
        block_timestamp,
        address as contract_address,
        topics,
        data
      from shopos_order_paid
sinks:
  shopos_webhook:
    type: webhook
    url: https://shopos-mezo-pay.vercel.app/api/webhook
    from: decode_order_paid
```

## Filtering Contract Address

Filter logs by the `ShopOSPayment` contract address, not by the MUSD ERC20 token address.

The webhook verifies:

- `token == NEXT_PUBLIC_MUSD_ADDRESS`
- `merchant == NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET`
- `amountMUSD >= paymentIntent.amountMUSD`
- `txHash` has not been processed before
- payment intent is not already confirmed

## Decoding OrderPaid

Goldsky may send raw `topics` and `data`, or decoded event fields. The ShopOS webhook supports both:

- raw log decoding with the `OrderPaid` ABI
- decoded payloads containing `paymentIntentId`, `orderId`, `merchant`, `payer`, `token`, `amount`

The indexed `paymentIntentId` and `orderId` are bytes32 values. ShopOS stores stable bytes32 hashes for each local payment intent and uses them for lookup.

## Why Not Listen Only to ERC20 Transfer

Do not rely only on the MUSD `Transfer` event. A token transfer only proves value moved; it does not carry the ShopOS `paymentIntentId` or `orderId`. `OrderPaid` binds the transfer to the checkout intent, merchant, payer, token, and amount in one event, which makes webhook confirmation deterministic.

