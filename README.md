Shopos Mezo: Mobile DePIN POS for Apparel Retail 👕⚡
Shopos Mezo is a specialized retail operating system designed for the apparel industry. By bridging a robust, industrial-grade DePIN POS with the Mezo Network, we enable fashion retailers to accept MUSD (Bitcoin-backed stablecoin) with instant settlement. It transforms Bitcoin from a speculative asset into a practical, daily medium of exchange for high-street retail.

🌟 Why Shopos Mezo?
In the fast-paced clothing retail sector, mobility and speed are non-negotiable. Traditional payment gateways charge 2-4% fees and take days to settle. Shopos Mezo offers:

Instant On-Chain Verification: Powered by Goldsky, merchants see "Success" in milliseconds.

Mobile-First Flexibility: No bulky hardware. A smartphone is all a shop assistant needs to check out a customer anywhere in the store.

Stable Pricing: Transactions are settled in MUSD, providing price stability for both merchants and shoppers while staying within the Bitcoin ecosystem.

🛠️ Technical Architecture
Our system has been refactored from a legacy desktop client to a modern, lightweight Mobile-First Stack to better serve retail shop floors.

Blockchain: Mezo (EVM-compatible Bitcoin L2)

Real-time Indexing: Goldsky - High-performance pipeline tracking MUSD ERC-20 transfers.

Backend: Vercel Serverless Functions (Node.js)

Database: Neon Postgres (Serverless) - Utilizing advanced matching logic for sender and recipient addresses.

Frontend: Next.js (Tailwind CSS) - Optimized for high-fidelity mobile touch interaction.

✨ Key Features
1. "Merchant-Scans-Customer" Workflow
Optimized for the high-street experience. The merchant scans the customer's wallet QR code, automatically capturing the sender address to prevent manual entry errors.

2. Smart Webhook Synchronization
We use a Goldsky-to-Vercel Webhook bridge. When a payment is detected on Mezo:

The Goldsky pipeline identifies the MUSD transfer.

The Vercel backend normalizes address cases and matches the sender, recipient, and amount.

The database status flips from pending to success instantly, triggering the POS UI update.

3. Precision Matching Logic
Our backend handles the complexity of EVM address checksums and case-sensitivity, ensuring that a transfer from 0x84ED... correctly matches an order logged as 0x84ed....

🚀 Getting Started
Environment Variables
To run this project locally, add the following to your .env.local:

Bash
DATABASE_URL=your_neon_postgres_connection_string
# Add any other specific environment keys used in your repo
Installation
Bash
# 1. Clone the repository
git clone https://github.com/youngerzhou/shopos-mezo-pay.git

# 2. Install dependencies
npm install

# 3. Run the development server
npm run dev
📈 Roadmap for Hackathon Final
[x] Core Pivot: Transition from Desktop/PHP to Mobile/Next.js.

[x] Real-time Integration: Successful Goldsky Webhook implementation.

[x] Database Schema: Implementation of sender tracking for precise order matching.

[ ] Active Payment Request: Integrating WalletConnect/AppKit to proactively trigger customer wallet confirmation pop-ups.

[ ] Inventory Sync: Linking MUSD payments to specific SKU/Size retail data.

📜 License
Distributed under the MIT License.
