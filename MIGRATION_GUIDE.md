# Environment Variable Migration Guide

## Migration to NEXT_PUBLIC_MUSD_TOKEN_ADDRESS

This guide helps you migrate from legacy environment variable names to the new canonical `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS`.

---

## Why Migrate?

We've standardized on a single, clear environment variable name for the MUSD token address to:

1. **Eliminate confusion** between multiple variable names
2. **Prevent configuration errors** on the customer payment page
3. **Improve error messages** when the variable is missing
4. **Simplify documentation** and onboarding

---

## Migration Steps

### Step 1: Identify Your Current Configuration

Check which legacy variable you're currently using:

```bash
# Check your .env.local file
grep -E "NEXT_PUBLIC.*MUSD" .env.local
```

You'll see one of these:
- `NEXT_PUBLIC_MUSD_ADDRESS` (legacy)
- `NEXT_PUBLIC_SHOPOS_MUSD_TOKEN` (legacy)
- `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` (canonical - no migration needed!)

### Step 2: Update Your Environment Variables

#### Option A: Local Development (.env.local)

**Before (Legacy):**
```env
NEXT_PUBLIC_MUSD_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
```

**After (Canonical):**
```env
NEXT_PUBLIC_MUSD_TOKEN_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
```

#### Option B: Vercel Production Environment

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Find the legacy variable (`NEXT_PUBLIC_MUSD_ADDRESS` or `NEXT_PUBLIC_SHOPOS_MUSD_TOKEN`)
3. Click the three dots (•••) and select **Edit**
4. Change the variable name to `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS`
5. Keep the same value
6. Click **Save**

#### Option C: Vercel Preview Environment

Repeat the same steps as Option B, but select the **Preview** environment.

### Step 3: Verify the Migration

1. **Check the value is correct:**
   - The address should be an ERC20 token contract on Mezo Testnet
   - It should NOT be a merchant wallet or payment contract address
   - Verify on Mezo Explorer: https://explorer.test.mezo.org/

2. **Test locally:**
   ```bash
   npm run dev
   ```
   - Open the customer payment page
   - Verify no "Missing environment configuration" error
   - Check the Diagnostics section shows the correct address

3. **Redeploy to Vercel:**
   - Go to Vercel Dashboard > Deployments
   - Click **Redeploy** on the latest production deployment
   - Wait for deployment to complete

### Step 4: Confirm Success

After redeployment, verify:

- [ ] Customer QR payment page loads without errors
- [ ] No "Missing NEXT_PUBLIC_MUSD_TOKEN_ADDRESS" error message
- [ ] MUSD balance displays correctly
- [ ] MUSD allowance displays correctly
- [ ] Payment flow works end-to-end
- [ ] Diagnostics section shows the configured address

---

## Backward Compatibility

The application maintains backward compatibility with legacy variable names during the migration period:

**Precedence Order:**
1. `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` (canonical - preferred)
2. `NEXT_PUBLIC_SHOPOS_MUSD_TOKEN` (legacy fallback)
3. `NEXT_PUBLIC_MUSD_ADDRESS` (legacy fallback)

If multiple variables are set, the canonical name takes precedence.

---

## Common Issues

### Issue: "Missing NEXT_PUBLIC_MUSD_TOKEN_ADDRESS" Error

**Cause:** The canonical variable is not set.

**Solution:**
1. Set `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` in your environment
2. Redeploy the application
3. Clear browser cache

### Issue: Address Not Loading After Migration

**Cause:** Vercel environment variables need redeployment.

**Solution:**
1. Verify the variable is set correctly in Vercel Dashboard
2. Redeploy the production deployment
3. Wait 1-2 minutes for the new deployment to be live
4. Hard refresh the browser (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Wrong Address Displayed

**Cause:** Multiple legacy variables are set with different values.

**Solution:**
1. Remove all legacy variables (`NEXT_PUBLIC_MUSD_ADDRESS`, `NEXT_PUBLIC_SHOPOS_MUSD_TOKEN`)
2. Keep only `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS`
3. Redeploy

---

## Verification Commands

### Check Local Configuration

```bash
# View all MUSD-related environment variables
grep -E "NEXT_PUBLIC.*MUSD" .env.local

# Verify the canonical variable is set
echo $NEXT_PUBLIC_MUSD_TOKEN_ADDRESS
```

### Check Vercel Configuration

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# View production environment variables
vercel env ls production

# View preview environment variables
vercel env ls preview
```

---

## Timeline

- **Now:** Migration recommended but legacy variables still supported
- **Future:** Legacy variable support will be deprecated
- **Action Required:** Migrate to `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` as soon as possible

---

## Need Help?

If you encounter issues during migration:

1. Check the browser console for detailed error logs
2. Review the Diagnostics section on the payment page
3. Consult the [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md) guide
4. Verify the token contract address on Mezo Explorer

---

## Summary

| Aspect | Legacy | Canonical |
|--------|--------|-----------|
| Variable Name | `NEXT_PUBLIC_MUSD_ADDRESS` or `NEXT_PUBLIC_SHOPOS_MUSD_TOKEN` | `NEXT_PUBLIC_MUSD_TOKEN_ADDRESS` |
| Status | Deprecated (still supported) | Recommended |
| Error Message | Generic "Missing environment configuration" | Clear "Missing NEXT_PUBLIC_MUSD_TOKEN_ADDRESS" |
| Documentation | Multiple sources | Single source of truth |

**Migration is simple:** Just rename your environment variable and redeploy!
