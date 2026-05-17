# ShopOS Mezo - Payment Architecture Guide

## Overview

ShopOS Mezo supports **two distinct payment modes** that both use smart contracts but serve different use cases. Both modes emit structured events for Goldsky webhook indexing and deterministic order reconciliation.

---

## Payment Mode 1: Merchant-Initiated Fast Pay / Pull Payment

### Use Case
Customer pre-authorizes a spending allowance, and the merchant POS can automatically pull payments without requiring the customer to sign transactions at payment time.

### Flow
1. **Setup (One-time)**: Customer visits registration page, connects wallet, and approves an allowance to the Pull Payment contract
2. **Payment**: Merchant POS creates an order, backend executes payment using the customer's pre-approved allowance
3. **Execution**: Backend relayer calls `pullPayment()` on the Pull Payment contract

### Technical Details
- **Initiator**: Merchant POS system
- **Customer Action at Payment Time**: None (pre-authorized)
- **Smart Contract**: [`ShoposPullPayment.sol`](contracts/ShoposPullPayment.sol)
- **ERC20 Operation**: `approve()` + `transferFrom()`
- **Required Environment Variables**:
  - `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` - MUSD ERC20 token contract
  - `NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT` - Pull Payment contract address
  - `RELAYER_PRIVATE_KEY` - Backend relayer private key (server-side only)

### User Experience Pages
- **Registration/Authorization**: [`/register`](src/app/register/page.tsx) - Customer sets up Fast Pay allowance
- **Membership Card**: [`/customer/membership-card`](src/app/customer/membership-card/page.tsx) - Customer views and manages Fast Pay authorization

### Code Flow
```typescript
// Backend executes pull payment
import { executePullPayment } from '@/app/lib/mezo-pull-payment';

const txHash = await executePullPayment(
  customerAddress,    // Customer's wallet
  merchantAddress,    // Merchant receives funds
  amount              // Payment amount in MUSD
);
```

---

## Payment Mode 2: Customer-Initiated QR Contract Payment ✅ CORRECT ARCHITECTURE

### Use Case
Customer scans a merchant QR code and pays by signing a transaction to the ShopOSPayment contract. The contract emits a structured `OrderPaid` event that Goldsky indexes for deterministic order reconciliation.

### Flow
1. **Payment Intent Creation**: Merchant POS creates payment intent with `paymentIntentId`, `orderId`, `merchant`, `amount`
2. **QR Code Generation**: QR code contains URL with all payment parameters
3. **Customer Scans**: Customer opens payment page, connects wallet
4. **Approval (if needed)**: Customer approves ShopOSPayment contract to spend MUSD (one-time per session)
5. **Payment Execution**: Customer calls `payOrder()` on ShopOSPayment contract
6. **Event Emission**: Contract emits `OrderPaid(paymentIntentId, orderId, merchant, payer, token, amount)`
7. **Goldsky Indexing**: Goldsky pipeline detects event and sends webhook to backend
8. **Order Reconciliation**: Backend matches `paymentIntentId`/`orderId` and confirms order

### Technical Details
- **Initiator**: Customer (scans QR code)
- **Customer Action at Payment Time**: Signs 1-2 transactions (approve + payOrder)
- **Smart Contract**: [`ShopOSPayment.sol`](contracts/ShopOSPayment.sol)
- **ERC20 Operation**: `approve()` → `payOrder()` which calls `transferFrom()`
- **Event Emitted**: 
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
- **Required Environment Variables**:
  - `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` - MUSD ERC20 token contract
  - `NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT` - ShopOSPayment contract address
  - `NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET` - Merchant wallet address (payment recipient)

### User Experience Pages
- **QR Payment**: [`/customer-pay`](src/app/customer-pay/page.tsx) - Customer scans QR code and pays via contract

### Code Flow
```typescript
// Step 1: Approve ShopOSPayment contract (if not already approved)
await writeContractAsync({
  address: musdAddress,
  abi: erc20Abi,
  functionName: 'approve',
  args: [paymentContract, amountInUnits]
});

// Step 2: Call payOrder() which emits OrderPaid event
await writeContractAsync({
  address: paymentContract,
  abi: shoposPaymentAbi,
  functionName: 'payOrder',
  args: [
    paymentIntentIdBytes32,
    orderIdBytes32,
    merchant,
    amountInUnits
  ]
});

// Contract internally does:
// IERC20(musd).transferFrom(msg.sender, merchant, amount);
// emit OrderPaid(paymentIntentId, orderId, merchant, msg.sender, musd, amount);
```

### Why Contract-Based QR Payment is Critical

#### ❌ Direct ERC20 Transfer Would Break The System

If we used direct `transfer()` instead of contract-based payment:

```typescript
// WRONG - This breaks Goldsky webhook integration!
await writeContractAsync({
  address: musdAddress,
  functionName: 'transfer',
  args: [merchant, amountInUnits]
});
```

**Problems:**
1. ❌ ERC20 `Transfer` event only contains `(from, to, value)`
2. ❌ No `paymentIntentId` or `orderId` in the event
3. ❌ Goldsky webhook cannot deterministically match payment to order
4. ❌ Backend must guess which order was paid based on amount/timestamp (unreliable)
5. ❌ Multiple orders with same amount become impossible to reconcile
6. ❌ Loses structured event semantics designed for webhook integration

#### ✅ Contract-Based QR Payment Preserves Architecture

```typescript
// CORRECT - Emits structured OrderPaid event
await writeContractAsync({
  address: paymentContract,
  functionName: 'payOrder',
  args: [paymentIntentIdBytes32, orderIdBytes32, merchant, amountInUnits]
});
```

**Benefits:**
1. ✅ `OrderPaid` event contains ALL metadata: `paymentIntentId`, `orderId`, `merchant`, `payer`, `token`, `amount`
2. ✅ Goldsky webhook can deterministically match event to payment intent
3. ✅ Backend reconciles order with 100% accuracy
4. ✅ Supports multiple concurrent orders with same amount
5. ✅ Full audit trail on-chain
6. ✅ Integrates seamlessly with existing webhook handler ([`musd-payment-webhook.ts`](src/app/lib/musd-payment-webhook.ts))

---

## Critical Differences

| Aspect | Mode 1: Fast Pay | Mode 2: QR Contract Payment |
|--------|------------------|---------------------------|
| **Initiator** | Merchant POS | Customer |
| **Customer Action** | Pre-authorize once | Sign each payment (1-2 txs) |
| **Transactions per Payment** | 0 (at payment time) | 1-2 (approve + payOrder) |
| **Approval Required** | Yes (one-time setup to pull payment contract) | Yes (per-session to ShopOSPayment contract) |
| **Allowance Check** | Yes (to pull payment contract) | No (checked dynamically during flow) |
| **Payment Contract** | Yes (Pull Payment) | Yes (ShopOSPayment) |
| **Recipient** | Merchant wallet (via contract) | Merchant wallet (via contract) |
| **Backend Relayer** | Required | Not required |
| **Event Emitted** | `PullPaymentExecuted(...)` (assumed) | `OrderPaid(paymentIntentId, orderId, ...)` |
| **Goldsky Integration** | Yes | Yes |
| **Order Reconciliation** | Deterministic | Deterministic |
| **Complexity** | Higher (requires setup) | Medium (contract interaction) |
| **Best For** | High-frequency merchants | One-time or occasional payments |

---

## Environment Variable Requirements

### For Both Modes
```env
# Required for both modes
NEXT_PUBLIC_MUSD_TOKEN_ADDRESS=0x...MUSD_ERC20_contract...
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://rpc.test.mezo.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Mode 1: Fast Pay Only
```env
# Fast Pay / Pull Payment specific
NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT=0x...pull_payment_contract...
RELAYER_PRIVATE_KEY=your_relayer_private_key  # Backend only!
```

### Mode 2: QR Contract Payment Only
```env
# QR Contract Payment specific
NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT=0x...shopos_payment_contract...
NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET=0x...merchant_wallet...
```

### NOT Used
```env
# These are NOT used in either mode:
# (No deprecated variables)
```

---

## Goldsky Webhook Integration

### Event Decoding

The webhook handler ([`musd-payment-webhook.ts`](src/app/lib/musd-payment-webhook.ts)) expects the `OrderPaid` event:

```typescript
const ORDER_PAID_EVENT = parseAbiItem(
  'event OrderPaid(bytes32 indexed paymentIntentId, bytes32 indexed orderId, address indexed merchant, address payer, address token, uint256 amount)'
);
```

### Payload Processing

```typescript
export async function processMusdOrderPaidWebhook(payload: unknown) {
  const normalizedEvents = normalizeGoldskyOrderPaidEvent(payload);
  
  for (const event of normalizedEvents) {
    // Find payment intent by paymentIntentId or orderId
    const intent = event.paymentIntentId
      ? findPaymentIntentByPaymentIntentIdOrBytes32(event.paymentIntentId)
      : findPaymentIntentByOrderId(event.orderId);
    
    // Validate event data
    if (!sameAddress(event.merchant, intent.merchantWallet)) { /* error */ }
    if (event.amountMUSD < intent.amountMUSD) { /* error */ }
    
    // Confirm payment intent
    markPaymentIntentConfirmed(intent, {
      txHash: event.txHash,
      payerWallet: event.payerWallet,
      blockNumber: event.blockNumber
    });
  }
}
```

### Why Structured Events Are Essential

The webhook relies on **indexed parameters** in the `OrderPaid` event:

```solidity
event OrderPaid(
    bytes32 indexed paymentIntentId,  // ← Indexed for efficient filtering
    bytes32 indexed orderId,          // ← Indexed for efficient filtering
    address indexed merchant,         // ← Indexed for efficient filtering
    address payer,                    // Non-indexed
    address token,                    // Non-indexed
    uint256 amount                    // Non-indexed
);
```

Goldsky can efficiently filter logs by:
- `paymentIntentId` topic
- `orderId` topic
- `merchant` topic

This enables **deterministic order reconciliation** without guessing.

---

## Common Configuration Mistakes

### ❌ Mistake 1: Confusing Pull Payment Contract with ShopOSPayment Contract
```env
# WRONG: Using same contract for both modes
NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT=0xabc...
NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT=0xabc...  # Should be different!

# CORRECT: Separate contracts for separate modes
NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT=0xfcd5c267e767b4a16cc471f9501309c313adb5a2
NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT=0xcf0e257daacba51cbfec1580f3593b3dfdc2802b
```

### ❌ Mistake 2: Removing ShopOSPayment Contract from QR Payment
```typescript
// WRONG: Using direct transfer instead of contract
await transfer(musdAddress, merchant, amount);  // No OrderPaid event!

// CORRECT: Use ShopOSPayment contract
await payOrder(paymentIntentIdBytes32, orderIdBytes32, merchant, amount);  // Emits OrderPaid!
```

### ❌ Mistake 3: Confusing Allowance Targets
```typescript
// WRONG: Checking allowance to pull payment contract in QR payment
allowance = getAllowance(customer, SHOPOS_PULL_PAYMENT_CONTRACT);  // Wrong contract!

// CORRECT: QR payment uses ShopOSPayment contract
allowance = getAllowance(customer, SHOPOS_PAYMENT_CONTRACT);  // Correct!
```

---

## Diagnostic Checklist

When troubleshooting payment issues, verify:

### For QR Contract Payment Mode
- [ ] `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` is set to a valid ERC20 contract
- [ ] `NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT` is set to ShopOSPayment contract address
- [ ] `NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET` is set to a wallet address (not a contract)
- [ ] The MUSD token address does NOT match the merchant wallet
- [ ] The MUSD token address does NOT match the ShopOSPayment contract
- [ ] Customer has sufficient MUSD balance
- [ ] Customer is on Mezo Testnet (chainId: 31611)
- [ ] Payment page shows "QR Contract Payment - Mode 2" indicator
- [ ] Diagnostics show "ShopOSPayment.payOrder() → emits OrderPaid event"
- [ ] Goldsky webhook receives `OrderPaid` events
- [ ] Backend reconciles orders via `paymentIntentId`/`orderId`

### For Fast Pay Mode
- [ ] `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` is set
- [ ] `NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT` is set
- [ ] Customer has pre-authorized allowance to the pull payment contract
- [ ] Backend has `RELAYER_PRIVATE_KEY` configured
- [ ] Pull Payment contract has operator permissions for the relayer

---

## Security Considerations

### QR Contract Payment Mode
- Customer signs transaction to trusted ShopOSPayment contract
- Contract validates inputs before executing transfer
- Structured event provides full audit trail
- Merchant receives funds directly from contract
- Goldsky webhook ensures deterministic reconciliation

### Fast Pay Mode
- Customer trusts the merchant with pre-authorized allowance
- Relayer executes payments on behalf of customer
- Requires careful allowance management
- Customer should monitor allowance regularly

---

## Testing Recommendations

### Test QR Contract Payment Mode
1. Set up `.env.local` with QR payment variables
2. Verify payment page loads without errors
3. Confirm "QR Contract Payment - Mode 2" indicator is shown
4. Test approval transaction (if needed)
5. Test payment transaction (payOrder call)
6. Verify `OrderPaid` event appears on Mezo Explorer
7. Confirm Goldsky webhook receives the event
8. Verify backend reconciles order correctly
9. Check order status updates to "confirmed"

### Test Fast Pay Mode
1. Set up `.env.local` with Fast Pay variables
2. Complete allowance authorization on `/register` page
3. Verify allowance appears on membership card page
4. Test backend pull payment execution
5. Confirm order status updates via webhook

---

## Support

For payment architecture questions:
- Review the diagnostics section on the payment page
- Check Mezo Explorer for transaction and event details
- Verify environment variable configuration
- Consult the code comments in [`customer-pay/page.tsx`](src/app/customer-pay/page.tsx)
- Review Goldsky webhook handler in [`musd-payment-webhook.ts`](src/app/lib/musd-payment-webhook.ts)
