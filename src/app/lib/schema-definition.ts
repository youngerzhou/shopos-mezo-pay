
/**
 * Database Schema Definition
 * This is the SINGLE SOURCE OF TRUTH for our database structure.
 * initDb in db.ts will use this to automatically sync the schema.
 */

export interface ColumnDefinition {
  type: string;
  default?: string;
  nullable?: boolean;
}

export const SCHEMA_DEFINITION = {
  transactions: {
    id: "TEXT PRIMARY KEY",
    sender: "TEXT",
    recipient: "TEXT NOT NULL",
    amount: "DECIMAL NOT NULL DEFAULT 1.00",
    original_amount: "DECIMAL",
    discount_rate: "DECIMAL DEFAULT 0",
    final_amount: "DECIMAL",
    status: "TEXT NOT NULL DEFAULT 'pending'",
    transaction_hash: "TEXT",
    passport_level: "INTEGER", // The new Mezo Passport Level column
    referral_id: "TEXT", // The ID of the person who shared the code
    commission_amount: "DECIMAL DEFAULT 0", // 5% payout calculated from original price
    session_token: "TEXT", // Added to link with pending registrations
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    updated_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  customers: {
    id: "TEXT PRIMARY KEY",
    wallet_address: "TEXT", // Removed UNIQUE NOT NULL to allow initial onboarding without wallet
    username: "TEXT", // Added for personalization
    contact_info: "TEXT", // Phone or Email
    referral_id: "TEXT UNIQUE NOT NULL", // Unique string for referrals
    referred_by_staff_id: "TEXT", // Added to track staff referrals
    level: "INTEGER DEFAULT 1",
    fast_pay_enabled: "BOOLEAN DEFAULT FALSE",
    fast_pay_allowance: "DECIMAL", // Authorized allowance amount for fast pay
    fast_pay_tx_hash: "TEXT", // Transaction hash for the approval transaction
    identity_verified: "BOOLEAN DEFAULT FALSE", // Track blockchain identity verification
    identity_signature: "TEXT", // Store wallet identity signature returned by MetaMask
    verified_at: "TIMESTAMP", // When identity was verified
    total_spent: "DECIMAL NOT NULL DEFAULT 0",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  user_coupons: {
    id: "TEXT PRIMARY KEY",
    customer_wallet: "TEXT NOT NULL",
    coupon_type: "TEXT NOT NULL",
    title: "TEXT NOT NULL",
    discount_amount: "DECIMAL NOT NULL",
    minimum_spend: "DECIMAL NOT NULL DEFAULT 0",
    status: "TEXT NOT NULL DEFAULT 'unused'",
    source: "TEXT NOT NULL",
    source_ref: "TEXT NOT NULL",
    used_order_id: "TEXT",
    used_at: "TIMESTAMP",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    expires_at: "TIMESTAMP NOT NULL"
  },
  member_levels: {
    id: "TEXT PRIMARY KEY",
    level_code: "TEXT UNIQUE NOT NULL",
    level_name: "TEXT NOT NULL",
    min_spend_amount: "DECIMAL NOT NULL DEFAULT 0",
    discount_rate: "DECIMAL NOT NULL DEFAULT 0",
    sort_order: "INTEGER NOT NULL DEFAULT 0",
    is_active: "BOOLEAN DEFAULT TRUE",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  staff: {
    id: "TEXT PRIMARY KEY",
    username: "TEXT UNIQUE NOT NULL",
    password_hash: "TEXT NOT NULL",
    staff_id: "TEXT UNIQUE NOT NULL", // Professional ID for QR linking
    role: "TEXT DEFAULT 'staff'", // admin, manager, staff
    store_id: "TEXT DEFAULT 'STORE_A'",
    total_referrals: "INTEGER DEFAULT 0",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    updated_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  pending_registrations: {
    id: "TEXT PRIMARY KEY",
    session_token: "TEXT UNIQUE NOT NULL",
    staff_id: "TEXT NOT NULL",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  settings: {
    key: "TEXT PRIMARY KEY",
    value: "TEXT NOT NULL",
    updated_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  webhook_logs: {
    id: "SERIAL PRIMARY KEY",
    payload: "JSONB NOT NULL",
    received_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  anomaly_logs: {
    id: "SERIAL PRIMARY KEY",
    type: "TEXT NOT NULL",
    referral_id: "TEXT",
    tx_hash: "TEXT",
    frontend_amount: "DECIMAL",
    onchain_amount: "TEXT",
    error_message: "TEXT",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  products: {
    id: "TEXT PRIMARY KEY",
    barcode: "TEXT UNIQUE NOT NULL",
    sku: "TEXT UNIQUE NOT NULL",
    name: "TEXT NOT NULL",
    category: "TEXT",
    brand: "TEXT",
    color: "TEXT",
    size: "TEXT",
    price: "DECIMAL NOT NULL",
    currency: "TEXT NOT NULL DEFAULT 'MUSD'",
    stock_qty: "INTEGER NOT NULL DEFAULT 0",
    image_url: "TEXT",
    is_active: "BOOLEAN DEFAULT TRUE",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  pos_orders: {
    id: "TEXT PRIMARY KEY",
    order_no: "TEXT UNIQUE NOT NULL",
    shop_id: "TEXT",
    customer_referral_id: "TEXT",
    customer_wallet: "TEXT",
    passport_level: "INTEGER DEFAULT 1",
    member_level_code: "TEXT",
    member_level_name: "TEXT",
    member_discount_rate: "DECIMAL DEFAULT 0",
    subtotal: "DECIMAL NOT NULL DEFAULT 0",
    discount_amount: "DECIMAL NOT NULL DEFAULT 0",
    coupon_id: "TEXT",
    coupon_discount_amount: "DECIMAL NOT NULL DEFAULT 0",
    total_amount: "DECIMAL NOT NULL DEFAULT 0",
    currency: "TEXT NOT NULL DEFAULT 'MUSD'",
    payment_status: "TEXT NOT NULL DEFAULT 'pending'",
    payment_tx_hash: "TEXT",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  pos_order_items: {
    id: "TEXT PRIMARY KEY",
    order_id: "TEXT NOT NULL",
    product_id: "TEXT NOT NULL",
    barcode: "TEXT NOT NULL",
    product_name: "TEXT NOT NULL",
    qty: "INTEGER NOT NULL DEFAULT 1",
    unit_price: "DECIMAL NOT NULL",
    discount_amount: "DECIMAL NOT NULL DEFAULT 0",
    line_total: "DECIMAL NOT NULL"
  }
};

export type TableName = keyof typeof SCHEMA_DEFINITION;
