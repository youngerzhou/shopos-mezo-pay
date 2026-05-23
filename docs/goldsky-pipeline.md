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

Use a block near the first known `OrderPaid` payment instead of `earliest`.

Known QR payment transaction:

```text
0x0565a28dc573e20194bbcedfa46cefad363869b601babf6ef0beedeec1038531
```

Receipt block:

```text
13,107,020
```

Recommended `start_at`:

```text
13,107,000
```

### Temporary Pipeline: Address Only

Use this first to confirm Goldsky can pick up any logs emitted by `ShopOSPayment`.

```yaml
name: mezo-testnet-erc-20
resource_size: s
apiVersion: 3
sources:
  shopos_payment_logs:
    type: dataset
    dataset_name: mezo-testnet.raw_logs
    version: 1.0.0
    start_at: 13107000
    filter: |
      address = lower('0x25eae9a5cc45b83a9f693f375fb04bc3dc809b78')
transforms:
  logs:
    type: sql
    primary_key: id
    sql: |
      select
        id,
        transaction_hash,
        block_number,
        block_timestamp,
        address as contract_address,
        topics,
        data,
        log_index,
        _gs_op
      from shopos_payment_logs
sinks:
  shopos_webhook:
    type: webhook
    url: https://shopos-mezo-pay.vercel.app/api/webhook
    from: logs
    one_row_per_request: true
```

### Final Pipeline: Address + OrderPaid Topic

Goldsky raw log examples treat `topics` as a comma-separated string in SQL transforms. Use `SPLIT_INDEX(topics, ',', 0)` for topic0 filtering instead of `topics LIKE '0x09e99...%'`.

```yaml
name: mezo-testnet-erc-20
resource_size: s
apiVersion: 3
sources:
  shopos_payment_logs:
    type: dataset
    dataset_name: mezo-testnet.raw_logs
    version: 1.0.0
    start_at: 13107000
    filter: |
      address = lower('0x25eae9a5cc45b83a9f693f375fb04bc3dc809b78')
transforms:
  order_paid_logs:
    type: sql
    primary_key: id
    sql: |
      select
        id,
        transaction_hash,
        block_number,
        block_timestamp,
        address as contract_address,
        topics,
        data,
        log_index,
        _gs_op
      from shopos_payment_logs
      where split_index(topics, ',', 0) = lower('0x09e99da262bb12c46eaeae571a859520dbb1218e8f6e186e4c0392269e98ed36')
sinks:
  shopos_webhook:
    type: webhook
    url: https://shopos-mezo-pay.vercel.app/api/webhook
    from: order_paid_logs
    one_row_per_request: true
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
