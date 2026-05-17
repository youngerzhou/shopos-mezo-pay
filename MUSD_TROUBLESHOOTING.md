# MUSD Token Configuration Troubleshooting Guide

## ✅ Verification Results

The configured MUSD token address `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` has been **verified as correct**:

- ✅ Contract exists on Mezo Testnet (chainId: 31611)
- ✅ Supports ERC20 interface (decimals, symbol, balanceOf)
- ✅ Returns correct values:
  - Symbol: **MUSD**
  - Decimals: **18**
  - Balance for test wallet: **561.63 MUSD**

---

## 🔍 Why You're Seeing "Failed to load token information"

If the contract is verified to be working but you still see this error in the browser, it's likely one of these issues:

### Issue 1: Browser Cache / Environment Variables Not Reloaded ⭐ MOST COMMON

**Symptoms:**
- `.env.local` has the correct address
- Node.js scripts work fine
- But browser shows "Failed to load token information"

**Root Cause:**
Next.js caches environment variables at build time. Changes to `.env.local` require a server restart.

**Solution:**
```bash
# Stop the development server (Ctrl+C)
# Then restart it:
npm run dev
```

Then in your browser:
- **Hard reload**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
- Or clear cache completely in browser DevTools

---

### Issue 2: Wrong Network in Wallet

**Symptoms:**
- Error appears after connecting wallet
- Console shows network mismatch

**Root Cause:**
Your wallet is connected to a different network (e.g., Ethereum Sepolia instead of Mezo Testnet).

**Solution:**
1. Check the network indicator in your wallet
2. Switch to **Mezo Testnet** (chainId: 31611)
3. If not available, add it manually:
   - Network Name: Mezo Testnet
   - RPC URL: https://rpc.test.mezo.org
   - Chain ID: 31611
   - Currency Symbol: ETH
   - Block Explorer: https://explorer.test.mezo.org/

---

### Issue 3: Wallet Not Connected

**Symptoms:**
- Page loads but shows no balance
- No error message, just empty state

**Root Cause:**
The `loadTokenState` function only runs when `isConnected && !isWrongNetwork`.

**Solution:**
1. Click "Connect Wallet" button
2. Select your wallet (MetaMask, WalletConnect, etc.)
3. Approve the connection
4. Ensure you're on Mezo Testnet

---

### Issue 4: RPC Endpoint Issues

**Symptoms:**
- Console shows network errors
- Timeout or CORS errors

**Root Cause:**
The RPC endpoint might be temporarily unavailable or rate-limited.

**Solution:**
1. Try accessing the RPC directly:
   ```bash
   curl https://rpc.test.mezo.org
   ```
2. If it fails, try an alternative RPC from Spectrum Dashboard
3. Update `.env.local`:
   ```
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://your-alternative-rpc.com
   ```
4. Restart dev server

---

### Issue 5: TypeScript Compilation Errors

**Symptoms:**
- Development server won't start
- Terminal shows compilation errors

**Root Cause:**
TypeScript errors preventing the app from building.

**Solution:**
```bash
# Check for errors
npm run build

# Fix any reported errors
# Then restart
npm run dev
```

---

## 🛠️ Debugging Steps

### Step 1: Run Diagnostic Script

```bash
node scripts/diagnose-musd.js
```

This will verify:
- ✅ Environment variable is set correctly
- ✅ Address format is valid
- ✅ Contract exists on-chain
- ✅ ERC20 functions work properly

### Step 2: Check Browser Console

Open browser DevTools (F12) and look for:

**Expected Success Logs:**
```
[CustomerPay] Token state loaded successfully: {
  paymentMode: 'qr-contract-payment-mode-2',
  tokenAddress: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503',
  paymentContract: '0xcf0e257daacba51cbfec1580f3593b3dfdc2802b',
  chainId: 31611,
  connectedWallet: '0x...',
  merchantWallet: '0x92a3C1AdC73F79818a09C6494a7bd28da9ea98E7',
  decimals: 18,
  symbol: 'MUSD',
  balance: '561.63'
}
```

**Error Logs to Look For:**
```
[CustomerPay] Failed to load token state: {
  tokenAddress: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503',
  contractCallFailureReason: '...',
  errorDetails: {...}
}
```

### Step 3: Verify Environment Variables in Browser

In browser console, type:
```javascript
console.log('MUSD Address:', process.env.NEXT_PUBLIC_MUSD_TOKEN_ADDRESS);
console.log('RPC URL:', process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);
console.log('Payment Contract:', process.env.NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT);
```

All should show values (not undefined).

### Step 4: Check Diagnostics Section on Page

The customer-pay page includes a diagnostics section that shows:
- Current network
- Connected wallet address
- Token configuration status
- Payment mode

Look for red error indicators.

---

## 📋 Configuration Checklist

Verify all of these are correct:

### `.env.local` File
```env
# ✅ Required
NEXT_PUBLIC_MUSD_TOKEN_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://rpc.test.mezo.org
NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET=0x92a3C1AdC73F79818a09C6494a7bd28da9ea98E7
NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT=0xcf0e257daacba51cbfec1580f3593b3dfdc2802b
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Optional (for Fast Pay mode)
NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT=0xfcd5c267e767b4a16cc471f9501309c313adb5a2
RELAYER_PRIVATE_KEY=your_relayer_private_key
```

### Vercel Environment Variables (if deployed)

Go to Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | Production + Preview |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | `https://rpc.test.mezo.org` | Production + Preview |
| `NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET` | `0x92a3C1AdC73F79818a09C6494a7bd28da9ea98E7` | Production + Preview |
| `NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT` | `0xcf0e257daacba51cbfec1580f3593b3dfdc2802b` | Production + Preview |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Your project ID | Production + Preview |

After updating, **redeploy** the application.

---

## 🔧 Quick Fixes

### Fix 1: Restart Development Server
```bash
# In terminal where npm run dev is running:
# Press Ctrl+C to stop
# Then restart:
npm run dev
```

### Fix 2: Clear Browser Cache
- Chrome: DevTools → Application → Clear Storage → Clear site data
- Firefox: Settings → Privacy → Clear Data
- Safari: Develop → Empty Caches

### Fix 3: Hard Reload
- Mac: `Cmd+Shift+R`
- Windows/Linux: `Ctrl+Shift+R`

### Fix 4: Reconnect Wallet
1. Disconnect wallet from the dApp
2. Refresh page
3. Reconnect wallet
4. Ensure correct network (Mezo Testnet)

### Fix 5: Use Incognito/Private Window
Sometimes extensions interfere with wallet connections. Try:
- Chrome: `Cmd+Shift+N` (Mac) or `Ctrl+Shift+N` (Windows)
- Firefox: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)

---

## 🚨 Common Error Messages & Solutions

### "Missing environment configuration"
**Cause:** Environment variable not set or not loaded  
**Fix:** 
1. Check `.env.local` has the variable
2. Restart dev server
3. Verify in browser console: `process.env.NEXT_PUBLIC_MUSD_TOKEN_ADDRESS`

### "Invalid token contract configuration"
**Cause:** Address validation failed  
**Fix:**
1. Verify address format: must be `0x` + 40 hex characters
2. Check it's not the same as merchant wallet or payment contract
3. Run diagnostic script: `node scripts/diagnose-musd.js`

### "Failed to load token information"
**Cause:** Contract call failed  
**Fix:**
1. Check browser console for detailed error
2. Verify wallet is connected to Mezo Testnet
3. Check RPC endpoint is accessible
4. Run diagnostic script

### "Please switch to Mezo Testnet"
**Cause:** Wallet on wrong network  
**Fix:**
1. Open wallet extension
2. Switch network to Mezo Testnet (chainId: 31611)
3. If not available, add it manually (see Issue 2 above)

---

## 📞 Still Having Issues?

If none of the above solutions work:

1. **Check GitHub Issues** for similar problems
2. **Collect Debug Information:**
   ```bash
   # Run diagnostic
   node scripts/diagnose-musd.js
   
   # Check Node version
   node --version
   
   # Check npm packages
   npm list wagmi viem connectkit
   ```

3. **Share Console Logs:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Copy all logs related to `[CustomerPay]`
   - Include any error messages

4. **Verify Contract on Explorer:**
   Visit: https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
   - Confirm contract is verified
   - Check recent transactions
   - Verify it's an ERC20 token

---

## ✅ Success Indicators

When everything is working correctly, you should see:

1. **No error messages** on the page
2. **Balance displayed**: e.g., "Balance: 561.63 MUSD"
3. **Diagnostics section shows:**
   - Network: Mezo Testnet (31611) ✅
   - Token: MUSD (18 decimals) ✅
   - Payment Mode: QR Contract Payment (Mode 2) ✅
   - ShopOSPayment contract: 0xcf0e... ✅
4. **Console logs** show successful token state loading
5. **"Pay MUSD" button** is enabled (if balance is sufficient)

---

## 📚 Related Documentation

- [Payment Architecture Guide](./PAYMENT_ARCHITECTURE.md)
- [Vercel Environment Setup](./VERCEL_ENV_SETUP.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Contract Separation Verification](./CONTRACT_SEPARATION_VERIFICATION.md)
