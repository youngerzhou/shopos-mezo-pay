
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
    wallet_address: "TEXT UNIQUE NOT NULL",
    referral_id: "TEXT UNIQUE NOT NULL", // Unique string for referrals
    referred_by_staff_id: "TEXT", // Added to track staff referrals
    level: "INTEGER DEFAULT 1",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  staff: {
    id: "TEXT PRIMARY KEY",
    username: "TEXT UNIQUE NOT NULL",
    password_hash: "TEXT NOT NULL",
    staff_id: "TEXT UNIQUE NOT NULL", // Professional ID for QR linking
    total_referrals: "INTEGER DEFAULT 0",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  pending_registrations: {
    id: "TEXT PRIMARY KEY",
    session_token: "TEXT UNIQUE NOT NULL",
    staff_id: "TEXT NOT NULL",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  webhook_logs: {
    id: "SERIAL PRIMARY KEY",
    payload: "JSONB NOT NULL",
    received_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  }
};

export type TableName = keyof typeof SCHEMA_DEFINITION;
