
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
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    updated_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  webhook_logs: {
    id: "SERIAL PRIMARY KEY",
    payload: "JSONB NOT NULL",
    received_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  }
};

export type TableName = keyof typeof SCHEMA_DEFINITION;
