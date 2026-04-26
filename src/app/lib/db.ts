
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
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
}

export type Order = Transaction;

/**
 * Global variable to hold the SQL client instance (singleton).
 */
let cachedSql: NeonQueryFunction<false, false> | null = null;

const getSql = () => {
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

let initialized = false;

async function ensureDb() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
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
      
      // Basic creation if not exists
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
          // Use raw query for DDL
          await sql(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
        }
      }
    }
    
    console.log('Database schema synchronized successfully based on definition');
  } catch (err) {
    console.error('Database schema synchronization failed:', err);
  }
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
  passportLevel?: number
): Promise<any> {
  await ensureDb();
  const sql = getSql();
  const id = Math.random().toString(36).substring(7);
  const normalizedRecipient = recipient.toLowerCase().trim();
  const normalizedSender = sender ? sender.toLowerCase().trim() : null;
  
  const finalAmount = amount;
  const origAmount = originalAmount || amount;
  const discRate = discountRate || 0;

  const results = await sql`
    INSERT INTO transactions (id, recipient, sender, amount, original_amount, discount_rate, final_amount, passport_level, status) 
    VALUES (${id}, ${normalizedRecipient}, ${normalizedSender}, ${finalAmount}, ${origAmount}, ${discRate}, ${finalAmount}, ${passportLevel}, 'pending')
    RETURNING 
      id, 
      recipient as wallet_address, 
      sender, 
      amount::float as amount_musd, 
      original_amount::float, 
      discount_rate::float, 
      final_amount::float, 
      passport_level,
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
  passportLevel?: number
) {
  // walletAddress is recipient in this POS context
  return createTransaction(walletAddress, amount, senderOrRecipient, originalAmount, discountRate, passportLevel);
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
  
  // Precise match: recipient + sender + amount
  let query = sql`
    SELECT id FROM transactions 
    WHERE LOWER(recipient) = ${normalizedRecipient} 
    AND amount = ${amount}
    AND status = 'pending'
  `;

  if (normalizedSender) {
    query = sql`
      SELECT id FROM transactions 
      WHERE LOWER(recipient) = ${normalizedRecipient} 
      AND LOWER(sender) = ${normalizedSender}
      AND amount = ${amount}
      AND status = 'pending' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
  } else {
    query = sql`
      SELECT id FROM transactions 
      WHERE LOWER(recipient) = ${normalizedRecipient} 
      AND amount = ${amount}
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
        amount = ${amount},
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
      status, 
      transaction_hash, 
      created_at
  `;

  if (results[0]) {
    console.log('ORDER_UPDATED_SUCCESSFULLY: ' + hash);
  }

  return results[0];
}

/**
 * Compatibility alias for updateOrderByWallet
 */
export async function updateOrderByWallet(walletAddress: string, status: string, hash?: string) {
  return updateTransactionByRecipient(walletAddress, 0, hash || '');
}
