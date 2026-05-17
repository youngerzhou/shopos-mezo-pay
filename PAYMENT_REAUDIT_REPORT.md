# Payment Architecture Re-Audit Report

## Executive Summary

**CRITICAL FINDING**: The previous refactor that changed QR payment from contract-based to direct ERC20 transfer was **architecturally incorrect** and would have broken the Goldsky webhook integration and order reconciliation system.

###  Issue Identified

The ShopOS Mezo system is designed around **structured blockchain events** indexed by Goldsky pipelines. The `OrderPaid` event emitted by the ShopOSPayment contract contains critical metadata (`paymentIntentId`, `orderId`, `merchant`, `payer`, `token`, `amount`) that enables **deterministic order reconciliation**.

Direct ERC20 `transfer()` only emits `(from, to, value)`, which lacks the metadata needed to match payments to orders reliably.

###  Correction Applied

**Restored contract-based QR payment flow** (Mode 2):
- Customer calls `ShopOSPayment.payOrder(paymentIntentId, orderId, merchant, amount)`
- Contract executes `transferFrom()` and emits `OrderPaid` event
- Goldsky indexes the event and sends webhook to backend
- Backend reconciles order using `paymentIntentId`/`orderId` from event

---

## Detailed Analysis

### 1. Goldsky Webhook Handler Design

**Location**: [`src/app/lib/musd-payment-webhook.ts`](src/app/lib/musd-payment-webhook.ts)

The webhook handler is explicitly designed to decode the `OrderPaid` event:

```typescript
const ORDER_PAID_EVENT = parseAbiItem(
  'event OrderPaid(bytes32 indexed paymentIntentId, bytes32 indexed orderId, address indexed merchant, address payer, address token, uint256 amount)'
);

export async function processMusdOrderPaidWebhook(payload: unknown) {
  const normalizedEvents = normalizeGoldskyOrderPaidEvent(payload);
  
  for (const event of normalizedEvents) {
    // Find payment intent by paymentIntentId or orderId
    const intent = event.paymentIntentId
      ? findPaymentIntentByPaymentIntentIdOrBytes32(event.paymentIntentId)
      : findPaymentIntentByOrderId(event.orderId);
    
    // Validate merchant matches
    if (!sameAddress(event.merchant, intent.merchantWallet)) { /* error */ }
    
    // Validate amount
    if (event.amountMUSD < intent.amountMUSD) { /* error */ }
    
    // Confirm payment intent with full metadata
    markPaymentIntentConfirmed(intent, {
      txHash: event.txHash,
      payerWallet: event.payerWallet,
      blockNumber: event.blockNumber
    });
  }
}
```

**Critical Dependencies**:
- ✅ `paymentIntentId` - Identifies which payment intent was paid
- ✅ `orderId` - Identifies which order was paid
- ✅ `merchant` - Validates payment went to correct merchant
- ✅ `payer` - Records who made the payment
- ✅ `token` - Confirms MUSD was used
- ✅ `amount` - Validates sufficient payment

### 2. ShopOSPayment Contract Design

**Location**: [`contracts/ShopOSPayment.sol`](contracts/ShopOSPayment.sol)

```solidity
contract ShopOSPayment {
    address public immutable musd;

    event OrderPaid(
        bytes32 indexed paymentIntentId,
        bytes32 indexed orderId,
        address indexed merchant,
        address payer,
        address token,
        uint256 amount
    );

    function payOrder(
        bytes32 paymentIntentId,
        bytes32 orderId,
        address merchant,
        uint256 amount
    ) external {
        require(merchant != address(0), "ShopOSPayment: invalid merchant");
        require(amount > 0, "ShopOSPayment: invalid amount");

        bool success = IERC20TransferFrom(musd).transferFrom(msg.sender, merchant, amount);
        require(success, "ShopOSPayment: transfer failed");

        emit OrderPaid(paymentIntentId, orderId, merchant, msg.sender, musd, amount);
    }
}
```

**Purpose**: 
- Executes ERC20 `transferFrom()` on behalf of customer
- Emits structured `OrderPaid` event with all reconciliation metadata
- Enables Goldsky to index and filter by `paymentIntentId`, `orderId`, `merchant`

### 3. QR Code Payload Design

**Location**: [`src/app/api/pos/payment-intents/route.ts`](src/app/api/pos/payment-intents/route.ts)

```typescript
const qrParams = new URLSearchParams({
  paymentIntentId: intent.id,
  orderId: intent.orderId,
  paymentIntentIdBytes32,
  orderIdBytes32,
  merchant: intent.merchantWallet,
  token: 'MUSD',
  amount: intent.amountMUSD.toFixed(2),
  network: 'mezo-testnet'
});
const qrPayload = `https://shopos-mezo-pay.vercel.app/customer-pay?${qrParams.toString()}`;
```

**Metadata Included**:
- ✅ `paymentIntentId` - Unique identifier for payment intent
- ✅ `orderId` - Unique identifier for order
- ✅ `merchant` - Recipient wallet address
- ✅ `amount` - Payment amount
- ✅ `paymentIntentIdBytes32` - Bytes32 version for contract call
- ✅ `orderIdBytes32` - Bytes32 version for contract call

This metadata is passed to the customer-pay page and used in the `payOrder()` contract call.

### 4. Why Direct Transfer Breaks The System

#### Scenario: Direct ERC20 Transfer (WRONG)

```typescript
// Customer pays via direct transfer
await writeContractAsync({
  address: musdAddress,
  functionName: 'transfer',
  args: [merchant, amountInUnits]
});
```

**On-chain Event**:
```
Transfer(from: 0xCustomer, to: 0xMerchant, value: 1000000000000000000)
```

**Problems**:
1. ❌ No `paymentIntentId` - Cannot identify which payment intent
2. ❌ No `orderId` - Cannot identify which order
3. ❌ Only has `from`, `to`, `value`
4. ❌ Goldsky webhook receives generic Transfer event
5. ❌ Backend must guess: "Which order did this 100 MUSD payment satisfy?"

**Reconciliation Failure Cases**:
- Multiple orders with same amount → Cannot determine which was paid
- Partial payments → Cannot track which order received partial payment
- Time-based matching → Unreliable due to block timing variations
- Amount collisions → Multiple customers paying same amount simultaneously

#### Scenario: Contract-Based Payment (CORRECT)

```typescript
// Customer pays via ShopOSPayment contract
await writeContractAsync({
  address: paymentContract,
  functionName: 'payOrder',
  args: [paymentIntentIdBytes32, orderIdBytes32, merchant, amountInUnits]
});
```

**On-chain Event**:
```
OrderPaid(
  paymentIntentId: 0x1234...,
  orderId: 0x5678...,
  merchant: 0xMerchant,
  payer: 0xCustomer,
  token: 0xMUSD,
  amount: 1000000000000000000
)
```

**Benefits**:
1. ✅ `paymentIntentId` present - Exact match to payment intent
2. ✅ `orderId` present - Exact match to order
3. ✅ All metadata included - Full context for reconciliation
4. ✅ Goldsky webhook decodes structured event
5. ✅ Backend confirms exact payment intent with 100% accuracy

**Reconciliation Success**:
- Multiple orders with same amount → Distinguished by `orderId`
- Partial payments → Tracked by `paymentIntentId`
- Simultaneous payments → Distinguished by unique IDs
- Full audit trail → Every payment linked to specific order

---

## Corrected Architecture

### Mode 1: Fast Pay / Pull Payment (Merchant-Initiated)

**Flow**:
1. Customer pre-authorizes allowance to Pull Payment contract
2. Merchant POS creates order
3. Backend relayer calls `pullPayment()` on Pull Payment contract
4. Contract executes `transferFrom(customer, merchant, amount)`
5. Event emitted (assumed `PullPaymentExecuted`)
6. Goldsky indexes event
7. Backend confirms order

**Characteristics**:
- Zero friction at payment time
- Requires one-time setup
- Best for high-frequency merchants
- Uses `NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT`

### Mode 2: QR Contract Payment (Customer-Initiated) ✅ CORRECTED

**Flow**:
1. Merchant POS creates payment intent with metadata
2. QR code generated with `paymentIntentId`, `orderId`, `merchant`, `amount`
3. Customer scans QR code
4. Customer connects wallet
5. Customer approves ShopOSPayment contract (if needed)
6. Customer calls `payOrder(paymentIntentId, orderId, merchant, amount)`
7. Contract executes `transferFrom(customer, merchant, amount)`
8. Contract emits `OrderPaid(paymentIntentId, orderId, merchant, payer, token, amount)`
9. Goldsky indexes `OrderPaid` event
10. Goldsky webhook sends payload to backend
11. Backend finds payment intent by `paymentIntentId`/`orderId`
12. Backend validates merchant and amount
13. Backend confirms order

**Characteristics**:
- Customer signs transaction(s)
- Emits structured event for Goldsky
- Deterministic order reconciliation
- Uses `NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT`
- Integrates with existing webhook handler

---

## Files Modified

### 1. [`src/app/customer-pay/page.tsx`](src/app/customer-pay/page.tsx)

**Changes**:
- ✅ Restored `shoposPaymentAbi` with `payOrder()` function
- ✅ Restored `approve()` function in ERC20 ABI
- ✅ Restored `paymentContract` variable from `NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT`
- ✅ Restored `approveMusd()` function for approval step
- ✅ Restored `payOrder()` function calling `ShopOSPayment.payOrder()`
- ✅ Updated UI indicator to show "QR Contract Payment - Mode 2"
- ✅ Updated diagnostics to show ShopOSPayment contract and Goldsky integration
- ✅ Added comments explaining contract-based architecture

**Key Code**:
```typescript
// Step 1: Approve ShopOSPayment contract
const approveMusd = async () => {
  await writeContractAsync({
    address: musdAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [paymentContract, amountInUnits]
  });
};

// Step 2: Call payOrder() which emits OrderPaid event
const payOrder = async () => {
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
};
```

### 2. [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md)

**Changes**:
- ✅ Completely rewritten to reflect correct contract-based architecture
- ✅ Added detailed explanation of why direct transfer breaks the system
- ✅ Documented Goldsky webhook integration requirements
- ✅ Explained structured event semantics
- ✅ Added comparison table between Mode 1 and Mode 2
- ✅ Added diagnostic checklists for both modes
- ✅ Added common configuration mistakes

### 3. [`.env.example`](.env.example)

**Already Correct**:
- ✅ Documents both payment modes
- ✅ Lists required variables for each mode
- ✅ Includes deployment notes

---

## Verification Checklist

### QR Contract Payment Mode Testing

After deploying corrections, verify:

- [ ] Customer QR payment page loads without errors
- [ ] "QR Contract Payment - Mode 2" indicator is displayed
- [ ] Diagnostics show "ShopOSPayment.payOrder() → emits OrderPaid event"
- [ ] Diagnostics show "Goldsky webhook: Indexes OrderPaid(...)"
- [ ] Diagnostics show "order reconciliation: Deterministic via paymentIntentId/orderId"
- [ ] Customer can approve ShopOSPayment contract (if needed)
- [ ] Customer can call `payOrder()` successfully
- [ ] `OrderPaid` event appears on Mezo Explorer with all parameters
- [ ] Goldsky webhook receives the event
- [ ] Backend reconciles order via `paymentIntentId`/`orderId`
- [ ] Order status updates to "confirmed"

### Goldsky Webhook Testing

- [ ] Webhook handler decodes `OrderPaid` event correctly
- [ ] `paymentIntentId` extracted from event
- [ ] `orderId` extracted from event
- [ ] `merchant` validated against expected merchant
- [ ] `amount` validated against payment intent
- [ ] Payment intent found by `paymentIntentId` or `orderId`
- [ ] Payment intent marked as confirmed
- [ ] Confirmation includes `txHash`, `payerWallet`, `blockNumber`

---

## Lessons Learned

### 1. Don't Optimize UX at Expense of Architecture

**Mistake**: Tried to simplify QR payment by removing contract interaction
**Impact**: Would have broken Goldsky webhook integration and order reconciliation
**Lesson**: Preserve architectural requirements even if they add complexity

### 2. Understand Event-Driven Systems

**Insight**: Goldsky webhook relies on structured events, not generic transfers
**Implication**: Smart contracts must emit events with all necessary metadata
**Action**: Always design contracts with indexing/reconciliation in mind

### 3. Two Contract-Based Modes Are Different

**Clarification**:
- Mode 1 (Fast Pay): Merchant-initiated, uses Pull Payment contract
- Mode 2 (QR Payment): Customer-initiated, uses ShopOSPayment contract
- Both are contract-based but serve different purposes
- Both emit structured events for Goldsky

**Key Distinction**: Not "contract vs. direct" but "which contract for which use case"

### 4. Metadata Matters

**Finding**: `OrderPaid` event contains 6 parameters for a reason
**Reason**: Each parameter serves a purpose in reconciliation:
- `paymentIntentId` - Identifies payment intent
- `orderId` - Identifies order
- `merchant` - Validates recipient
- `payer` - Records sender
- `token` - Confirms currency
- `amount` - Validates value

**Lesson**: Don't remove metadata "to simplify" - it's there for a reason

---

## Conclusion

The corrected architecture properly separates the two payment modes while preserving the event-driven design required for Goldsky webhook integration and deterministic order reconciliation.

**Status**: ✅ RE-AUDIT COMPLETE - ARCHITECTURE CORRECTED

### Before Correction (WRONG)
❌ QR payment used direct ERC20 `transfer()`  
❌ No `OrderPaid` event emitted  
❌ Goldsky webhook cannot reconcile orders  
❌ Lost `paymentIntentId` and `orderId` metadata  
❌ Would break production system  

### After Correction (CORRECT)
✅ QR payment uses `ShopOSPayment.payOrder()`  
✅ `OrderPaid` event emitted with full metadata  
✅ Goldsky webhook can reconcile orders deterministically  
✅ Preserves `paymentIntentId` and `orderId` in event  
✅ Integrates seamlessly with existing infrastructure  

The system now correctly implements:
- **Mode 1**: Fast Pay / Pull Payment (merchant-initiated, backend relayer)
- **Mode 2**: QR Contract Payment (customer-initiated, contract emits events)

Both modes use smart contracts and emit structured events for reliable blockchain event indexing, Goldsky pipeline reconciliation, and deterministic order tracking.
