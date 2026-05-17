# ShopOS Mezo - Vercel Environment Variables Configuration Guide

## Required Environment Variables for Production Deployment

### 1. MUSD Token Address (CRITICAL)

**Variable Name:** `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS`

**Description:** The deployed MUSD ERC20 token contract address on Mezo Testnet.

**️ IMPORTANT:**
- This MUST be a valid ERC20 token contract, NOT:
  - Merchant wallet address
  - Pull payment contract address
  - Payment processor contract address
  - Any non-ERC20 contract
- The contract must support: `decimals()`, `balanceOf()`, `allowance()`, `symbol()`, `approve()`
- Verify the address on Mezo Explorer: https://explorer.test.mezo.org/

**Example:**
```
NEXT_PUBLIC_MUSD_TOKEN_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
```

---

## Step-by-Step Vercel Configuration

### Step 1: Access Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your ShopOS Mezo project
3. Navigate to **Settings** > **Environment Variables**

### Step 2: Add Production Environment Variables

Click **Add** and configure the following variables for **Production** environment:

#### Required Variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` | Your MUSD ERC20 token address | Production |
| `NEXT_PUBLIC_SHOPOS_PAYMENT_CONTRACT` | Your payment contract address | Production |
| `NEXT_PUBLIC_SHOPOS_PULL_PAYMENT_CONTRACT` | Your pull payment contract address | Production |
| `NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET` | Merchant wallet address | Production |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | https://rpc.test.mezo.org | Production |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Your WalletConnect project ID | Production |

### Step 3: Add Preview Environment Variables (Optional)

If you use preview deployments, repeat Step 2 for the **Preview** environment:

1. Select **Preview** from the environment dropdown
2. Add the same variables (you can use the same values or different ones for testing)

### Step 4: Verify Configuration

1. Go to your project's **Deployments** tab
2. Click on the latest production deployment
3. Check the **Environment Variables** section to confirm all variables are set
4. Look for any build errors related to missing environment variables

### Step 5: Redeploy

After adding/updating environment variables:

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest production deployment
3. Wait for the deployment to complete
4. Test the customer QR payment page

---

## Verification Checklist

Before going live, verify:

- [ ] `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` is set in Vercel Production environment
- [ ] The address points to a valid ERC20 MUSD token contract on Mezo Testnet
- [ ] The contract supports all required ERC20 functions
- [ ] The address does NOT match merchant wallet or payment contracts
- [ ] Customer QR payment page loads without "Missing environment configuration" error
- [ ] MUSD balance and allowance display correctly
- [ ] Payment flow works end-to-end

---

## Troubleshooting

### Error: "Missing NEXT_PUBLIC_MUSD_TOKEN_ADDRESS"

**Solution:**
1. Check Vercel Dashboard > Settings > Environment Variables
2. Ensure `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` is set for Production environment
3. Redeploy the application
4. Clear browser cache and test again

### Error: "Invalid token contract configuration"

**Possible Causes:**
- The address is not a valid ERC20 contract
- The contract doesn't support required functions
- Network mismatch (check chainId is 31611 for Mezo Testnet)

**Solution:**
1. Verify the contract address on Mezo Explorer
2. Test the contract functions using a tool like Remix or Hardhat
3. Check browser console for detailed error logs
4. Ensure the address is NOT a wallet address or non-ERC20 contract

### Error: "MUSD token address matches the merchant wallet address"

**Solution:**
- You've accidentally set the merchant wallet address instead of the MUSD token contract
- Update `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` to the correct ERC20 token contract address

---

## Legacy Environment Variables (Deprecated)

The following legacy variables are still supported for backward compatibility but should be migrated to `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS`:

- `NEXT_PUBLIC_MUSD_ADDRESS` (deprecated)
- `NEXT_PUBLIC_SHOPOS_MUSD_TOKEN` (deprecated)

**Migration:** Simply rename your environment variable to `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` and redeploy.

---

## Security Notes

- Never commit `.env.local` files to version control
- Keep your `.env.example` file updated with variable names (no secrets)
- Use Vercel's environment variable encryption for sensitive values
- Rotate WalletConnect project ID if compromised

---

## Contact & Support

For issues with environment configuration or deployment:
- Check the browser console for detailed error logs
- Review the Diagnostics section on the payment page
- Consult the ShopOS Mezo documentation
