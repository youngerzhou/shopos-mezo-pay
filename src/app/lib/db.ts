
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Global variable to hold the SQL client instance (singleton).
 * This prevents creating multiple connections in a serverless environment.
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
 * Initialize Database Schema
 */
export async function initDb() {
  const sql = getSql();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        recipient TEXT NOT NULL,
        amount DECIMAL NOT NULL DEFAULT 1.00,
        status TEXT NOT NULL DEFAULT 'pending',
        transaction_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id SERIAL PRIMARY KEY,
        payload JSONB NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
}

/**
 * Create a new transaction (renamed from order for consistency with request)
 */
export async function createTransaction(recipient: string, amount: number = 1.0): Promise<Transaction> {
  await ensureDb();
  const sql = getSql();
  const id = Math.random().toString(36).substring(7);
  const normalizedRecipient = recipient.toLowerCase().trim();

  const results = await sql`
    INSERT INTO transactions (id, recipient, amount, status) 
    VALUES (${id}, ${normalizedRecipient}, ${amount}, 'pending')
    RETURNING id, recipient as wallet_address, amount::float as amount_musd, status, transaction_hash, created_at
  `;

  return results[0] as unknown as Transaction;
}

/**
 * Compatibility alias for createOrder
 */
export async function createOrder(walletAddress: string, amount: number = 1.0) {
  return createTransaction(walletAddress, amount);
}

/**
 * Retrieve a transaction
 */
export async function getTransaction(id: string): Promise<any | undefined> {
  await ensureDb();
  const sql = getSql();
  const results = await sql`
    SELECT id, recipient as wallet_address, amount::float as amount_musd, status, transaction_hash, created_at 
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
 * Update transaction via Webhook (Matches latest pending transaction for address)
 * Requirement: 当 Goldsky 推送数据时，将 transaction_hash、amount、recipient 存入 transactions 表中，并将状态设为 'success'。
 */
export async function updateTransactionByRecipient(recipient: string, amount: number, hash: string) {
  await ensureDb();
  const sql = getSql();
  const normalizedRecipient = recipient.toLowerCase().trim();
  
  // Find the latest pending transaction for this recipient
  const pending = await sql`
    SELECT id FROM transactions 
    WHERE LOWER(recipient) = ${normalizedRecipient} 
    AND status = 'pending' 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  if (pending.length === 0) {
    console.warn(`[Neon] No pending transaction found for: ${normalizedRecipient}. Inserting success record.`);
    const id = Math.random().toString(36).substring(7);
    const results = await sql`
      INSERT INTO transactions (id, recipient, amount, status, transaction_hash)
      VALUES (${id}, ${normalizedRecipient}, ${amount}, 'success', ${hash})
      RETURNING id, recipient as wallet_address, amount::float as amount_musd, status, transaction_hash, created_at
    `;
    
    if (results[0]) {
       console.log('ORDER_UPDATED_SUCCESSFULLY: ' + hash);
    }
    return results[0];
  }

  const results = await sql`
    UPDATE transactions 
    SET status = 'success', 
        transaction_hash = ${hash}, 
        amount = ${amount},
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ${pending[0].id}
    RETURNING id, recipient as wallet_address, amount::float as amount_musd, status, transaction_hash, created_at
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
