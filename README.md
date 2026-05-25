
# ShopOS Mezo
Mobile-first Web3 retail operating system powered by MUSD.
ShopOS Mezo is a mobile-first retail POS system that combines Web3 payments with real merchant workflows including checkout, membership, coupons, Fast Pay, pickup orders, staff performance tracking, and reconciliation.
## Demo
- Live Demo: https://shopos-mezo-pay.vercel.app/
- Presentation: https://gamma.app/docs/Mobile-first-Web3-Retail-Operating-System-v7g4ayhig82vulw
- Demo Video: https://youtu.be/F-KTkoOTHO8
---
## What Problem Are We Solving?
Most Web3 payment demos stop at:
> Connect wallet → Pay
Real merchants need much more:
- POS checkout
- QR-code payment
- Membership & loyalty
- Coupon redemption
- Repeat customer payment flow
- Staff performance tracking
- Pickup order fulfillment
- End-of-day reconciliation
ShopOS Mezo bridges MUSD payments with real-world retail operations.
---
## Key Features
### Mobile-first POS checkout
- Create retail orders
- Generate QR payment codes
- Mobile-first interface
- Staff-linked sales tracking
### MUSD Wallet Payments
- QR-code payment flow
- Wallet connection
- MUSD checkout
- Payment confirmation
### Goldsky Real-time Payment Pipeline
- Realtime blockchain event indexing
- Merchant payment visibility
- Faster payment confirmation
### Membership & Coupons
- Register with phone or email
- Welcome incentives
- Coupon issuance
- Coupon redemption at checkout
### Fast Pay
Returning customers can authorize Fast Pay to reduce repeated wallet approval friction.
### Self-Service Pickup Orders
Customers can:
1. Place order
2. Pay with MUSD
3. Receive pickup QR code
Store staff can quickly fulfill pickup requests.
### Staff Performance Tracking
Each order is linked to staff performance metrics.
Merchants can monitor:
- Sales contribution
- Staff performance
- Operational activity
### Daily Reconciliation
Generate merchant operational reports:
- Payment totals
- Order status
- Membership activity
- Blockchain references
- Staff sales performance
---
## Closed-loop Retail Flow
```text
Merchant creates order
        ↓
Customer scans QR code
        ↓
MUSD payment
        ↓
Goldsky realtime indexing
        ↓
Payment confirmation
        ↓
Membership + coupon redemption
        ↓
Pickup QR generation
        ↓
Merchant reconciliation

Acquire → Pay → Reward → Reorder → Pickup → Reconcile

⸻

Screenshots

Add screenshots here:

* POS checkout
* QR payment
* Membership page
* Coupon flow
* Pickup QR
* Reconciliation dashboard

⸻

Tech Stack

* Next.js
* TypeScript
* React
* Neon Postgres
* Vercel
* Wagmi
* Goldsky realtime indexing
* Mezo Testnet
* MUSD

⸻

Running Locally

Clone repository:

git clone https://github.com/youngerzhou/shopos-mezo-pay.git
cd shopos-mezo-pay

Install dependencies:

npm install

Start development server:

npm run dev

Open:

http://localhost:3000

⸻

Roadmap

Phase 1 — Mainnet readiness

* Refund flow
* Exchange handling
* Partial refund support
* Production hardening

Phase 2 — Merchant admin console

* Coupon management
* Staff dashboard
* Role-based access control

Phase 3 — Retail pilot

* Apparel stores
* Pop-up stores
* Event retail

⸻

Founder

Younger Zhou
Founder / Product Lead / Full-Stack Developer

X: https://x.com/youngerzhou
LinkedIn: https://www.linkedin.com/in/youngerzhou/
re