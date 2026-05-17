import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { roundMoney2, roundDiscountRate } from '@/app/lib/money';
import { SCHEMA_DEFINITION } from './schema-definition';

/**
 * Transaction Model and Status
 */
export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface Transaction {
  id: string;
  wallet_address: string;
  sender?: string;
  amount_musd: number;
  original_amount?: number;
  discount_rate?: number;
  final_amount?: number;
  status: string;
  transaction_hash?: string;
  created_at: any;
  passport_level?: number;
  referral_id?: string;
  commission_amount?: number;
  session_token?: string;
}

export type Order = Transaction;

export interface PosOrderItemInput {
  barcode: string;
  qty: number;
}

export interface CreatePosOrderPayload {
  shopId?: string;
  customerReferralId?: string;
  customerWallet?: string;
  couponId?: string | null;
  passportLevel?: 0 | 1 | 2 | 3;
  currency?: string;
  items: PosOrderItemInput[];
}

export interface MemberLevel {
  id: string;
  level_code: string;
  level_name: string;
  min_spend_amount: number;
  discount_rate: number;
  sort_order: number;
  is_active: boolean;
  created_at?: any;
}

export interface CustomerMembership {
  referral_id: string;
  username: string | null;
  wallet_address?: string | null;
  wallet_address_display?: string | null;
  total_spent: number;
  level: number;
  level_code: string;
  level_name: string;
  discount_rate: number;
  min_spend_amount: number;
}

export interface UserCoupon {
  id: string;
  customer_wallet: string;
  coupon_type: 'threshold_discount' | 'cash_discount' | string;
  title: string;
  discount_amount: number;
  minimum_spend: number;
  status: 'unused' | 'used' | 'expired' | string;
  source: 'NEW_MEMBER_SIGNUP' | 'FAST_PAY_AUTHORIZED' | string;
  source_ref: string;
  created_at?: any;
  expires_at: any;
}

/**
 * Global variable to hold the SQL client instance (singleton).
 */
let cachedSql: NeonQueryFunction<false, false> | null = null;

export const getSql = () => {
  if (cachedSql) return cachedSql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    // Check if we are in build environment
    const isBuild = process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME;
    if (isBuild || process.env.CI) {
      console.warn('DATABASE_URL is missing (Build environment). Using mock client.');
      return ((...args: any[]) => Promise.resolve([])) as any;
    }
    throw new Error('DATABASE_URL is not defined in environment variables');
  }

  cachedSql = neon(url);
  return cachedSql;
};

let initPromise: Promise<void> | null = null;

export async function ensureDb() {
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      await initDb();
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  })();

  await initPromise;
}

/**
 * Settings Helpers
 */
export async function getSetting(key: string, defaultValue: string): Promise<string> {
  await ensureDb();
  const sql = getSql();
  const res = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return res[0]?.value || defaultValue;
}

export async function updateSetting(key: string, value: string) {
  await ensureDb();
  const sql = getSql();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
  `;
}

/**
 * Initialize Database Schema with automatic Sync
 * Uses SCHEMA_DEFINITION as the source of truth.
 */
export async function initDb() {
  const sql = getSql();
  console.log('Starting dynamic database schema sync...');

  try {
    for (const [tableName, columns] of Object.entries(SCHEMA_DEFINITION)) {
      // 1. Create table if not exists with at least the first column
      const colNames = Object.keys(columns);
      const firstCol = colNames[0];
      const firstColDef = columns[firstCol as keyof typeof columns];

      // Basic creation if not exists (neon() returns a query fn, not pg Pool — use sql(string), not .query())
      await sql(`CREATE TABLE IF NOT EXISTS ${tableName} (${firstCol} ${firstColDef})`);

      // 2. Check each column and ALTER if missing
      for (const [colName, colDef] of Object.entries(columns)) {
        // Skip the first column as it's handled by CREATE TABLE
        if (colName === firstCol) continue;

        const columnExists = await sql`
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = ${tableName} 
          AND column_name = ${colName}
        `;

        if (columnExists.length === 0) {
          console.log(`[Schema Sync] Adding missing column: ${colName} to ${tableName}`);
          await sql(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
        }
      }
    }

    console.log('Database schema synchronized successfully based on definition');

    // Phase 1 FIX: Ensure wallet_address is nullable in customers table for new dual-scan workflow
    await sql(`ALTER TABLE customers ALTER COLUMN wallet_address DROP NOT NULL`);
    await sql(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_coupons_wallet_source_ref_idx
      ON user_coupons (LOWER(customer_wallet), source, source_ref)
    `);
    await sql(`
      CREATE INDEX IF NOT EXISTS payment_intents_order_id_idx
      ON payment_intents (order_id)
    `);
    await sql(`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_tx_hash_unique_idx
      ON payment_intents (LOWER(tx_hash))
      WHERE tx_hash IS NOT NULL
    `);

    // Seed a demo staff member if none exists
    const demoStaff = await sql`SELECT 1 FROM staff WHERE staff_id = 'STAFF001'`;
    if (demoStaff.length === 0) {
      console.log('[Seed] Seeding demo staff member...');
      await sql`
        INSERT INTO staff (id, username, password_hash, staff_id)
        VALUES ('s1', 'demo_staff', 'hashed_pass', 'STAFF001')
      `;
    }

    const memberLevels = [
      { id: 'level_member', level_code: 'member', level_name: 'Member', min_spend_amount: 0, discount_rate: 0, sort_order: 1 },
      { id: 'level_silver', level_code: 'silver', level_name: 'Silver', min_spend_amount: 100, discount_rate: 0.02, sort_order: 2 },
      { id: 'level_gold', level_code: 'gold', level_name: 'Gold', min_spend_amount: 1000, discount_rate: 0.05, sort_order: 3 },
      { id: 'level_platinum', level_code: 'platinum', level_name: 'Platinum', min_spend_amount: 5000, discount_rate: 0.08, sort_order: 4 }
    ];

    for (const level of memberLevels) {
      await sql`
        INSERT INTO member_levels (
          id, level_code, level_name, min_spend_amount, discount_rate, sort_order, is_active
        )
        VALUES (
          ${level.id},
          ${level.level_code},
          ${level.level_name},
          ${level.min_spend_amount},
          ${level.discount_rate},
          ${level.sort_order},
          TRUE
        )
        ON CONFLICT (level_code) DO UPDATE SET
          level_name = EXCLUDED.level_name,
          min_spend_amount = EXCLUDED.min_spend_amount,
          discount_rate = EXCLUDED.discount_rate,
          sort_order = EXCLUDED.sort_order,
          is_active = TRUE
      `;
    }

    const demoCustomers = [
      { id: 'cust_demo_member', username: 'Mia Member', referral_id: 'MEM_MEMBER', level: 1, total_spent: 0 },
      { id: 'cust_demo_silver', username: 'Sam Silver', referral_id: 'MEM_SILVER', level: 2, total_spent: 100 },
      { id: 'cust_demo_gold', username: 'Grace Gold', referral_id: 'MEM_GOLD', level: 3, total_spent: 1000 },
      { id: 'cust_demo_platinum', username: 'Parker Platinum', referral_id: 'MEM_PLATINUM', level: 4, total_spent: 5000 }
    ];

    for (const customer of demoCustomers) {
      await sql`
        INSERT INTO customers (id, username, referral_id, level, total_spent)
        VALUES (
          ${customer.id},
          ${customer.username},
          ${customer.referral_id},
          ${customer.level},
          ${customer.total_spent}
        )
        ON CONFLICT (referral_id) DO UPDATE SET
          username = EXCLUDED.username,
          level = EXCLUDED.level,
          total_spent = GREATEST(customers.total_spent, EXCLUDED.total_spent)
      `;
    }

    const demoProducts = [
      {
        id: 'prod_demo_tee_black_m',
        barcode: 'SHOPOS100',
        sku: 'MEZO-TEE-BLK-M',
        name: 'Mezo Logo Tee',
        category: 'Tops',
        brand: 'ShopOS',
        color: 'Black',
        size: 'M',
        price: 100,
        stock_qty: 24,
        image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'prod_demo_hoodie_green_l',
        barcode: 'SHOPOS500',
        sku: 'MEZO-HOOD-GRN-L',
        name: 'Passport Hoodie',
        category: 'Outerwear',
        brand: 'ShopOS',
        color: 'Forest',
        size: 'L',
        price: 500,
        stock_qty: 12,
        image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'prod_demo_jacket_silver_m',
        barcode: 'SHOPOS1000',
        sku: 'MEZO-JKT-SLV-M',
        name: 'Hackathon Tech Jacket',
        category: 'Outerwear',
        brand: 'ShopOS',
        color: 'Silver',
        size: 'M',
        price: 1000,
        stock_qty: 8,
        image_url: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'prod_demo_tote_cream',
        barcode: 'SHOPOS200',
        sku: 'MEZO-TOTE-CRM',
        name: 'Canvas City Tote',
        category: 'Bags',
        brand: 'ShopOS',
        color: 'Cream',
        size: 'One Size',
        price: 180,
        stock_qty: 18,
        image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'prod_demo_sneaker_white_42',
        barcode: 'SHOPOS300',
        sku: 'MEZO-SNK-WHT-42',
        name: 'Everyday Leather Sneaker',
        category: 'Shoes',
        brand: 'ShopOS',
        color: 'White',
        size: '42',
        price: 320,
        stock_qty: 16,
        image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'prod_demo_cap_orange',
        barcode: 'SHOPOS400',
        sku: 'MEZO-CAP-ORG',
        name: 'Orange Logo Cap',
        category: 'Accessories',
        brand: 'ShopOS',
        color: 'Orange',
        size: 'Adjustable',
        price: 90,
        stock_qty: 30,
        image_url: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?q=80&w=600&auto=format&fit=crop'
      }
    ];

    for (const product of demoProducts) {
      await sql`
        INSERT INTO products (id, barcode, sku, name, category, brand, color, size, price, currency, stock_qty, image_url, is_active)
        VALUES (
          ${product.id},
          ${product.barcode},
          ${product.sku},
          ${product.name},
          ${product.category},
          ${product.brand},
          ${product.color},
          ${product.size},
          ${product.price},
          'MUSD',
          ${product.stock_qty},
          ${product.image_url},
          TRUE
        )
        ON CONFLICT (barcode) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          brand = EXCLUDED.brand,
          color = EXCLUDED.color,
          size = EXCLUDED.size,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          stock_qty = GREATEST(products.stock_qty, EXCLUDED.stock_qty),
          image_url = EXCLUDED.image_url,
          is_active = TRUE
      `;
    }
  } catch (err) {
    console.error('Database schema synchronization failed:', err);
  }
}

export async function getMemberLevelBySpend(totalSpent: number): Promise<MemberLevel> {
  await ensureDb();
  const sql = getSql();
  const spend = roundMoney2(totalSpent);
  const results = await sql`
    SELECT
      id,
      level_code,
      level_name,
      min_spend_amount::float,
      discount_rate::float,
      sort_order,
      is_active,
      created_at
    FROM member_levels
    WHERE is_active = TRUE
    AND min_spend_amount <= ${spend}
    ORDER BY min_spend_amount DESC, sort_order DESC
    LIMIT 1
  `;

  return results[0] || {
    id: 'level_member',
    level_code: 'member',
    level_name: 'Member',
    min_spend_amount: 0,
    discount_rate: 0,
    sort_order: 1,
    is_active: true
  };
}

export async function getCustomerMembership(referralId: string): Promise<CustomerMembership | null> {
  await ensureDb();
  const sql = getSql();
  const normalizedReferralId = referralId.trim();

  const customers = await sql`
    SELECT
      referral_id,
      username,
      wallet_address,
      COALESCE(total_spent, 0)::float as total_spent,
      COALESCE(level, 1)::int as level
    FROM customers
    WHERE referral_id = ${normalizedReferralId}
    LIMIT 1
  `;

  if (customers.length === 0) return null;

  const customer = customers[0];
  const walletAddress = customer.wallet_address ? String(customer.wallet_address).toLowerCase().trim() : null;
  const memberLevel = await getMemberLevelBySpend(Number(customer.total_spent || 0));

  if (Number(customer.level) !== Number(memberLevel.sort_order)) {
    await sql`
      UPDATE customers
      SET level = ${memberLevel.sort_order}
      WHERE referral_id = ${normalizedReferralId}
    `;
  }

  return {
    referral_id: customer.referral_id,
    username: customer.username || null,
    wallet_address: walletAddress,
    wallet_address_display: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null,
    total_spent: roundMoney2(Number(customer.total_spent || 0)),
    level: Number(memberLevel.sort_order),
    level_code: memberLevel.level_code,
    level_name: memberLevel.level_name,
    discount_rate: Number(memberLevel.discount_rate || 0),
    min_spend_amount: Number(memberLevel.min_spend_amount || 0)
  };
}

export async function getProductByBarcode(barcode: string) {
  await ensureDb();
  const sql = getSql();
  const normalizedBarcode = barcode.trim();
  const results = await sql`
    SELECT
      id,
      barcode,
      sku,
      name,
      category,
      brand,
      color,
      size,
      price::float,
      currency,
      stock_qty,
      image_url,
      is_active,
      created_at
    FROM products
    WHERE barcode = ${normalizedBarcode}
    AND is_active = TRUE
    LIMIT 1
  `;
  return results[0];
}

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase().trim();
}

function couponExpiry(days = 90) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

export async function issueNewMemberCoupon(customerWallet?: string | null): Promise<UserCoupon | null> {
  if (!customerWallet) return null;

  await ensureDb();
  const sql = getSql();
  const wallet = normalizeWalletAddress(customerWallet);
  const id = `cpn_new_${Math.random().toString(36).substring(2, 10)}`;
  const results = await sql`
    INSERT INTO user_coupons (
      id, customer_wallet, coupon_type, title, discount_amount, minimum_spend,
      status, source, source_ref, expires_at
    )
    VALUES (
      ${id}, ${wallet}, 'threshold_discount', '新会员满100减5', 5, 100,
      'unused', 'NEW_MEMBER_SIGNUP', 'NEW_MEMBER_SIGNUP', ${couponExpiry()}
    )
    ON CONFLICT DO NOTHING
    RETURNING
      id, customer_wallet, coupon_type, title,
      discount_amount::float, minimum_spend::float,
      status, source, source_ref, created_at, expires_at
  `;

  if (results[0]) return results[0] as UserCoupon;

  const existing = await sql`
    SELECT
      id, customer_wallet, coupon_type, title,
      discount_amount::float, minimum_spend::float,
      status, source, source_ref, created_at, expires_at
    FROM user_coupons
    WHERE LOWER(customer_wallet) = ${wallet}
    AND source = 'NEW_MEMBER_SIGNUP'
    AND source_ref = 'NEW_MEMBER_SIGNUP'
    LIMIT 1
  `;
  return (existing[0] as UserCoupon) || null;
}

export async function issueFastPayAuthorizationCoupon(
  customerWallet?: string | null,
  authorizedAmount?: number,
  sourceRef?: string | null
): Promise<UserCoupon | null> {
  if (!customerWallet) return null;

  const allowance = roundMoney2(Number(authorizedAmount || 0));
  if (!Number.isFinite(allowance) || allowance <= 0) return null;

  await ensureDb();
  const sql = getSql();
  const wallet = normalizeWalletAddress(customerWallet);
  const ref = sourceRef?.trim() || `ALLOWANCE_${allowance}`;
  const discountAmount = roundMoney2(allowance * 0.01);
  const id = `cpn_fp_${Math.random().toString(36).substring(2, 10)}`;

  const results = await sql`
    INSERT INTO user_coupons (
      id, customer_wallet, coupon_type, title, discount_amount, minimum_spend,
      status, source, source_ref, expires_at
    )
    VALUES (
      ${id}, ${wallet}, 'cash_discount', 'Fast Pay 授权奖励券', ${discountAmount}, 0,
      'unused', 'FAST_PAY_AUTHORIZED', ${ref}, ${couponExpiry()}
    )
    ON CONFLICT DO NOTHING
    RETURNING
      id, customer_wallet, coupon_type, title,
      discount_amount::float, minimum_spend::float,
      status, source, source_ref, created_at, expires_at
  `;

  if (results[0]) return results[0] as UserCoupon;

  const existing = await sql`
    SELECT
      id, customer_wallet, coupon_type, title,
      discount_amount::float, minimum_spend::float,
      status, source, source_ref, created_at, expires_at
    FROM user_coupons
    WHERE LOWER(customer_wallet) = ${wallet}
    AND source = 'FAST_PAY_AUTHORIZED'
    AND source_ref = ${ref}
    LIMIT 1
  `;
  return (existing[0] as UserCoupon) || null;
}

export async function getAvailableCoupons(customerWallet: string, orderAmount?: number): Promise<UserCoupon[]> {
  await ensureDb();
  const sql = getSql();
  const wallet = normalizeWalletAddress(customerWallet);
  const amount = orderAmount == null ? null : roundMoney2(Number(orderAmount));

  const results = await sql`
    SELECT
      id, customer_wallet, coupon_type, title,
      discount_amount::float, minimum_spend::float,
      status, source, source_ref, created_at, expires_at
    FROM user_coupons
    WHERE LOWER(customer_wallet) = ${wallet}
    AND status = 'unused'
    AND expires_at > CURRENT_TIMESTAMP
    AND (${amount}::decimal IS NULL OR minimum_spend <= ${amount})
    ORDER BY discount_amount DESC, created_at ASC
  `;
  return results as UserCoupon[];
}

async function validateCouponForOrder(couponId: string, customerWallet: string, payableAmount: number) {
  const sql = getSql();
  const wallet = normalizeWalletAddress(customerWallet);
  const amount = roundMoney2(payableAmount);

  const results = await sql`
    SELECT
      id, customer_wallet, coupon_type, title,
      discount_amount::float, minimum_spend::float,
      status, source, source_ref, created_at, expires_at
    FROM user_coupons
    WHERE id = ${couponId}
    LIMIT 1
  `;

  const coupon = results[0] as UserCoupon | undefined;
  if (!coupon) throw new Error('Coupon not found');
  if (normalizeWalletAddress(coupon.customer_wallet) !== wallet) throw new Error('Coupon does not belong to this customer');
  if (coupon.status !== 'unused') throw new Error('Coupon is not available');
  if (new Date(coupon.expires_at).getTime() <= Date.now()) throw new Error('Coupon has expired');
  if (amount < Number(coupon.minimum_spend || 0)) throw new Error('Order amount does not meet coupon minimum spend');

  return coupon;
}

export async function createPosOrder(payload: CreatePosOrderPayload) {
  await ensureDb();
  const sql = getSql();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (items.length === 0) {
    throw new Error('Cart is empty');
  }

  const requestedPassportLevel = Number(payload.passportLevel || 0);
  const passportLevel = ([1, 2, 3].includes(requestedPassportLevel) ? requestedPassportLevel : 0) as 0 | 1 | 2 | 3;
  const customerReferralId = payload.customerReferralId?.trim() || null;
  const membership = customerReferralId ? await getCustomerMembership(customerReferralId) : null;
  if (customerReferralId && !membership) {
    throw new Error('Member not found');
  }
  const discountRate = Number(membership?.discount_rate || 0);
  const currency = payload.currency || 'MUSD';
  const orderId = `pos_${Math.random().toString(36).substring(2, 10)}`;
  const orderNo = `POS-${Date.now().toString(36).toUpperCase()}`;
  const createdAt = new Date().toISOString();

  let subtotal = 0;
  let discountAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const qty = Math.max(1, Math.trunc(Number(item.qty) || 1));
    const product = await getProductByBarcode(item.barcode);

    if (!product) {
      throw new Error(`Product not found: ${item.barcode}`);
    }

    if (Number(product.stock_qty) < qty) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_qty}, requested: ${qty}`);
    }

    const unitPrice = roundMoney2(Number(product.price));
    const lineSubtotal = roundMoney2(unitPrice * qty);
    const lineDiscount = roundMoney2(lineSubtotal * discountRate);
    const lineTotal = roundMoney2(lineSubtotal - lineDiscount);

    subtotal = roundMoney2(subtotal + lineSubtotal);
    discountAmount = roundMoney2(discountAmount + lineDiscount);
    orderItems.push({
      id: `poi_${Math.random().toString(36).substring(2, 10)}`,
      product,
      qty,
      unitPrice,
      lineDiscount,
      lineTotal
    });
  }

  const normalizedWallet = payload.customerWallet ? payload.customerWallet.toLowerCase().trim() : null;
  let couponId = payload.couponId?.trim() || null;
  let couponDiscountAmount = 0;

  if (couponId) {
    if (!normalizedWallet) {
      throw new Error('Customer wallet is required to use coupon');
    }

    const coupon = await validateCouponForOrder(couponId, normalizedWallet, roundMoney2(subtotal - discountAmount));
    couponDiscountAmount = roundMoney2(Math.min(Number(coupon.discount_amount || 0), roundMoney2(subtotal - discountAmount)));
  }

  const totalAmount = roundMoney2(subtotal - discountAmount - couponDiscountAmount);

  await sql`
    INSERT INTO pos_orders (
      id, order_no, shop_id, customer_referral_id, customer_wallet, passport_level,
      member_level_code, member_level_name, member_discount_rate,
      subtotal, discount_amount, coupon_id, coupon_discount_amount, total_amount, currency, payment_status
    )
    VALUES (
      ${orderId},
      ${orderNo},
      ${payload.shopId || 'STORE_A'},
      ${customerReferralId},
      ${normalizedWallet},
      ${passportLevel},
      ${membership?.level_code || null},
      ${membership?.level_name || null},
      ${discountRate},
      ${subtotal},
      ${discountAmount},
      ${couponId},
      ${couponDiscountAmount},
      ${totalAmount},
      ${currency},
      'pending'
    )
  `;

  for (const item of orderItems) {
    await sql`
      INSERT INTO pos_order_items (
        id, order_id, product_id, barcode, product_name, qty,
        unit_price, discount_amount, line_total
      )
      VALUES (
        ${item.id},
        ${orderId},
        ${item.product.id},
        ${item.product.barcode},
        ${item.product.name},
        ${item.qty},
        ${item.unitPrice},
        ${item.lineDiscount},
        ${item.lineTotal}
      )
    `;

    await sql`
      UPDATE products
      SET stock_qty = stock_qty - ${item.qty}
      WHERE id = ${item.product.id}
    `;
  }

  return {
    order_id: orderId,
    order_no: orderNo,
    created_at: createdAt,
    total_amount: totalAmount,
    currency,
    member_level_code: membership?.level_code || null,
    member_level_name: membership?.level_name || null,
    member_discount_rate: discountRate,
    coupon_id: couponId,
    coupon_discount_amount: couponDiscountAmount
  };
}

export async function markPosOrderPaid(orderId: string, txHash: string) {
  await ensureDb();
  const sql = getSql();

  const updated = await sql`
    UPDATE pos_orders
    SET payment_status = 'paid',
        payment_tx_hash = ${txHash}
    WHERE id = ${orderId}
    AND payment_status <> 'paid'
    RETURNING
      id,
      order_no,
      customer_referral_id,
      coupon_id,
      total_amount::float,
      currency,
      payment_status,
      payment_tx_hash
  `;

  if (updated.length === 0) {
    const existing = await sql`
      SELECT
        id,
        order_no,
        customer_referral_id,
        coupon_id,
        total_amount::float,
        currency,
        payment_status,
        payment_tx_hash
      FROM pos_orders
      WHERE id = ${orderId}
      LIMIT 1
    `;

    if (existing.length === 0) {
      throw new Error('POS order not found');
    }

    return {
      ...existing[0],
      membership: existing[0].customer_referral_id
        ? await getCustomerMembership(existing[0].customer_referral_id)
        : null
    };
  }

  const order = updated[0];
  let membership = null;

  if (order.coupon_id) {
    await sql`
      UPDATE user_coupons
      SET status = 'used',
          used_order_id = ${order.id},
          used_at = CURRENT_TIMESTAMP
      WHERE id = ${order.coupon_id}
      AND status = 'unused'
    `;
  }

  if (order.customer_referral_id) {
    const current = await sql`
      SELECT COALESCE(total_spent, 0)::float as total_spent
      FROM customers
      WHERE referral_id = ${order.customer_referral_id}
      LIMIT 1
    `;

    if (current.length > 0) {
      const nextTotalSpent = roundMoney2(Number(current[0].total_spent || 0) + Number(order.total_amount || 0));
      const nextLevel = await getMemberLevelBySpend(nextTotalSpent);

      await sql`
        UPDATE customers
        SET total_spent = ${nextTotalSpent},
            level = ${nextLevel.sort_order}
        WHERE referral_id = ${order.customer_referral_id}
      `;

      membership = {
        referral_id: order.customer_referral_id,
        username: null,
        total_spent: nextTotalSpent,
        level: Number(nextLevel.sort_order),
        level_code: nextLevel.level_code,
        level_name: nextLevel.level_name,
        discount_rate: Number(nextLevel.discount_rate || 0),
        min_spend_amount: Number(nextLevel.min_spend_amount || 0)
      };
    }
  }

  return {
    ...order,
    membership
  };
}

/**
 * Create a new transaction
 */
export async function createTransaction(
  recipient: string,
  amount: number = 1.0,
  sender?: string,
  originalAmount?: number,
  discountRate?: number,
  passportLevel?: number,
  referralId?: string,
  commissionAmount?: number,
  sessionToken?: string,
  status: string = 'pending',
  transactionHash: string | null = null
): Promise<any> {
  await ensureDb();
  const sql = getSql();
  const id = Math.random().toString(36).substring(7);
  const normalizedRecipient = recipient.toLowerCase().trim();
  const normalizedSender = sender ? sender.toLowerCase().trim() : null;

  const finalAmount = roundMoney2(amount);
  const origAmount = roundMoney2(originalAmount ?? amount);
  const discRate = roundDiscountRate(discountRate || 0);
  const commissionRounded =
    commissionAmount != null ? roundMoney2(commissionAmount) : null;

  const results = await sql`
    INSERT INTO transactions (id, recipient, sender, amount, original_amount, discount_rate, final_amount, passport_level, referral_id, commission_amount, session_token, status, transaction_hash) 
    VALUES (${id}, ${normalizedRecipient}, ${normalizedSender}, ${finalAmount}, ${origAmount}, ${discRate}, ${finalAmount}, ${passportLevel}, ${referralId}, ${commissionRounded}, ${sessionToken}, ${status}, ${transactionHash})
    RETURNING 
      id, 
      recipient as wallet_address, 
      sender, 
      amount::float as amount_musd, 
      original_amount::float, 
      discount_rate::float, 
      final_amount::float, 
      passport_level,
      referral_id,
      commission_amount::float,
      session_token,
      status, 
      transaction_hash, 
      created_at
  `;

  return results[0];
}

/**
 * Compatibility alias for createOrder
 */
export async function createOrder(
  walletAddress: string,
  amount: number = 1.0,
  senderOrRecipient?: string,
  originalAmount?: number,
  discountRate?: number,
  passportLevel?: number,
  referralId?: string,
  commissionAmount?: number,
  sessionToken?: string,
  status: string = 'pending',
  transactionHash: string | null = null
) {
  // walletAddress is recipient in this POS context
  return createTransaction(walletAddress, amount, senderOrRecipient, originalAmount, discountRate, passportLevel, referralId, commissionAmount, sessionToken, status, transactionHash);
}

/**
 * Customer helpers
 */
export async function getCustomerByReferralId(referralId: string) {
  await ensureDb();
  const sql = getSql();
  const results = await sql`SELECT * FROM customers WHERE referral_id = ${referralId}`;
  return results[0];
}

export async function createCustomer(referral_id: string, level: number = 1, referred_by_staff_id?: string, wallet_address?: string) {
  await ensureDb();
  const sql = getSql();
  const id = Math.random().toString(36).substring(7);
  const normalizedWallet = wallet_address ? wallet_address.toLowerCase().trim() : null;

  const results = await sql`
    INSERT INTO customers (id, wallet_address, referral_id, level, referred_by_staff_id)
    VALUES (${id}, ${normalizedWallet}, ${referral_id}, ${level}, ${referred_by_staff_id})
    ON CONFLICT (referral_id) DO UPDATE SET 
      level = EXCLUDED.level, 
      referred_by_staff_id = EXCLUDED.referred_by_staff_id,
      wallet_address = COALESCE(customers.wallet_address, EXCLUDED.wallet_address)
    RETURNING *
  `;
  if (results[0]?.wallet_address) {
    await issueNewMemberCoupon(results[0].wallet_address);
  }
  return results[0];
}

export async function bindWalletToCustomer(referral_id: string, wallet_address: string) {
  await ensureDb();
  const sql = getSql();
  const normalizedWallet = wallet_address.toLowerCase().trim();

  const results = await sql`
    UPDATE customers 
    SET wallet_address = ${normalizedWallet}
    WHERE referral_id = ${referral_id} AND wallet_address IS NULL
    RETURNING *
  `;
  if (results[0]?.wallet_address) {
    await issueNewMemberCoupon(results[0].wallet_address);
  }
  return results[0];
}

/**
 * Staff and Registration helpers
 */
export async function getStaffByStaffId(staffId: string) {
  await ensureDb();
  const sql = getSql();
  const results = await sql`SELECT * FROM staff WHERE staff_id = ${staffId}`;
  return results[0];
}

export async function createPendingRegistration(staffId: string, sessionToken: string) {
  await ensureDb();
  const sql = getSql();
  const id = Math.random().toString(36).substring(7);
  const results = await sql`
    INSERT INTO pending_registrations (id, session_token, staff_id)
    VALUES (${id}, ${sessionToken}, ${staffId})
    ON CONFLICT (session_token) DO UPDATE SET staff_id = EXCLUDED.staff_id
    RETURNING *
  `;
  return results[0];
}

export async function getPendingRegistration(sessionToken: string) {
  await ensureDb();
  const sql = getSql();
  const results = await sql`SELECT * FROM pending_registrations WHERE session_token = ${sessionToken}`;
  return results[0];
}

export async function incrementStaffReferral(staffId: string) {
  await ensureDb();
  const sql = getSql();
  await sql`UPDATE staff SET total_referrals = total_referrals + 1 WHERE staff_id = ${staffId}`;
}

export async function getCustomerByWallet(walletAddress: string) {
  await ensureDb();
  const sql = getSql();
  const normalizedWallet = walletAddress.toLowerCase().trim();
  const results = await sql`SELECT * FROM customers WHERE LOWER(wallet_address) = ${normalizedWallet}`;
  return results[0];
}

/**
 * Retrieve a transaction
 */
export async function getTransaction(id: string): Promise<any | undefined> {
  await ensureDb();
  const sql = getSql();
  const results = await sql`
    SELECT 
      id, 
      recipient as wallet_address, 
      sender,
      amount::float as amount_musd, 
      original_amount::float,
      discount_rate::float,
      final_amount::float,
      passport_level,
      referral_id,
      commission_amount::float,
      session_token,
      status, 
      transaction_hash, 
      created_at 
    FROM transactions WHERE id = ${id}
  `;
  if (results.length === 0) return undefined;
  return results[0];
}

/**
 * Compatibility alias for getOrder
 */
export async function getOrder(id: string) {
  return getTransaction(id);
}

/**
 * Record a raw webhook payload
 */
export async function logWebhook(payload: any) {
  await ensureDb();
  const sql = getSql();
  await sql`
    INSERT INTO webhook_logs (payload) 
    VALUES (${payload})
  `;
}

/**
 * Get latest webhook logs
 */
export async function getWebhookLogs(limit: number = 20) {
  await ensureDb();
  const sql = getSql();
  return await sql`SELECT * FROM webhook_logs ORDER BY received_at DESC LIMIT ${limit}`;
}

/**
 * Update transaction via Webhook
 */
export async function updateTransactionByRecipient(recipient: string, amount: number, hash: string, sender?: string) {
  await ensureDb();
  const sql = getSql();
  const normalizedRecipient = recipient.toLowerCase().trim();
  const normalizedSender = sender ? sender.toLowerCase().trim() : null;
  const amountMatch = roundMoney2(amount);

  // Precise match: recipient + sender + amount
  let query = sql`
    SELECT id FROM transactions 
    WHERE LOWER(recipient) = ${normalizedRecipient} 
    AND amount = ${amountMatch}
    AND status = 'pending'
  `;

  if (normalizedSender) {
    query = sql`
      SELECT id FROM transactions 
      WHERE LOWER(recipient) = ${normalizedRecipient} 
      AND LOWER(sender) = ${normalizedSender}
      AND amount = ${amountMatch}
      AND status = 'pending' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
  } else {
    query = sql`
      SELECT id FROM transactions 
      WHERE LOWER(recipient) = ${normalizedRecipient} 
      AND amount = ${amountMatch}
      AND status = 'pending' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
  }

  const pending = await query;

  if (pending.length === 0) {
    console.warn(`[Neon] No pending transaction found for: ${normalizedRecipient} (Sender: ${normalizedSender}). Not creating new record as requested.`);
    return null;
  }

  const results = await sql`
    UPDATE transactions 
    SET status = 'success', 
        transaction_hash = ${hash}, 
        amount = ${amountMatch},
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ${pending[0].id}
    RETURNING 
      id, 
      recipient as wallet_address, 
      sender, 
      amount::float as amount_musd, 
      original_amount::float,
      discount_rate::float,
      final_amount::float,
      passport_level,
      referral_id,
      commission_amount::float,
      status, 
      transaction_hash, 
      created_at
  `;

  if (results[0]) {
    console.log('ORDER_UPDATED_SUCCESSFULLY: ' + hash);

    // Auto-Bind Logic
    const tx = results[0];
    if (tx.sender) {
      const existingCustomer = await getCustomerByWallet(tx.sender);
      if (!existingCustomer && tx.session_token) {
        const pending = await getPendingRegistration(tx.session_token);
        if (pending) {
          console.log(`[Auto-Bind] Binding wallet ${tx.sender} to staff ${pending.staff_id}`);
          // Create new customer and link to referral ID
          const newCustomerReferralId = 'ref_' + Math.random().toString(36).substring(7);
          await createCustomer(newCustomerReferralId, tx.passport_level || 1, pending.staff_id, tx.sender);
          // Increment staff referral count
          await incrementStaffReferral(pending.staff_id);
        }
      }
    }
  }

  return results[0];
}

/**
 * Compatibility alias for updateOrderByWallet
 */
export async function updateOrderByWallet(walletAddress: string, status: string, hash?: string) {
  return updateTransactionByRecipient(walletAddress, 0, hash || '');
}
