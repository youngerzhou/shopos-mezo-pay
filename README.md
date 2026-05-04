# ShopOS Mezo

**The “Alipay” of Web3 — Secure Bitcoin-backed Mobile Payments.**

ShopOS Mezo delivers a **closed-loop retail payment stack** on the **Mezo Network**: shoppers scan a QR code, confirm in their wallet, and pay in **MUSD** (Bitcoin-backed stable value) while merchants get **real-time feedback** and **durable order records** off-chain—matching the speed and simplicity of a super-app, with Web3 guarantees.

---

## The complete technical loop

1. **Surface (Vercel)** — The Next.js app is deployed on **Vercel** for low-latency delivery, env-based configuration, and CI-friendly previews—so POS and mobile flows stay responsive worldwide.
2. **Wallet & chain (Mezo + Spectrum Nodes)** — Users connect via standard Web3 flows; transactions target **Mezo** with **Spectrum Nodes** providing reliable **RPC** access for reads, writes, and confirmation tracking.
3. **Speed layer (Goldsky)** — **Goldsky** powers **real-time indexing and pipelines**, so confirmation and event-driven updates can approach **sub-second** perception—aligned with traditional retail checkout expectations.
4. **Persistence (Neon)** — **Neon Postgres** (serverless) stores **orders, customers, staff context, and sync state**, keeping **on-chain events** and **merchant / inventory views** consistent without running a dedicated DB fleet.
5. **Trust & incentives (Gitcoin Passport)** — **Gitcoin Passport** scores feed **Allowance Tiers** in the product UI: higher reputation can unlock **tiered allowances** and **up to ~10% bonus discounts**, reducing sybil-style abuse while rewarding proven humans.

Together: **QR → wallet → MUSD on Mezo → indexed / confirmed fast → Neon order sync → merchant-ready state**.

---

## Core features

### Scan-to-Pay closed loop

A **seamless mobile experience**: **QR scanning** routes the user into checkout, then **instant Bitcoin-backed (MUSD) payments** settle via the **Mezo Network**—one continuous flow from scan to receipt-like certainty.

### Real-time performance

**Spectrum Nodes (RPC)** for dependable chain access, plus **Goldsky** for real-time data movement and indexing—aiming for **sub-second** perceived confirmation to **match traditional retail speed**.

### Sybil resistance (Gitcoin Passport)

Users with a stronger **Gitcoin Passport** footprint are eligible for **Allowance Tiers** (surfaced in the UI), mapping **on-chain reputation** to **bonus discounts** (up to **10%** in the tier model)—rewarding real participants over disposable identities.

### Reliable infrastructure

- **Vercel** — High-performance hosting, edge-friendly delivery, and environment-driven config for hackathon demos and production-shaped deploys.
- **Neon Postgres** — **Serverless** relational storage for **order synchronization** between **on-chain lifecycle** and **merchant / operational** data—durable, scalable, and simple to wire from serverless API routes.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Application routes live under `src/app/`.

## Environment

Set WalletConnect, RPC (e.g. Spectrum / Mezo test endpoints), database (Neon), and any indexer or Passport-related keys in `.env` or **Vercel** project settings. See `src/components/Web3Provider.tsx` and `src/app/lib/` for required variables.

---

*ShopOS Mezo — closed-loop Web3 payments that feel like Alipay, backed by Bitcoin-derived MUSD on Mezo.*
