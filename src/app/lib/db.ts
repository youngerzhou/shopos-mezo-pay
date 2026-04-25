
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

/**
 * Order Model and Status
 */
export type OrderStatus = 'pending' | 'paid' | 'failed';

export interface Order {
  id: string;
  wallet_address: string;
  amount_musd: number;
  status: OrderStatus;
  transaction_hash?: string;
  created_at: string;
}

let dbInstance: Database | null = null;

/**
 * Get SQLite Database instance
 */
async function getDb() {
  if (dbInstance) return dbInstance;
  
  dbInstance = await open({
    filename: path.join(process.cwd(), 'shopos.db'),
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      amount_musd REAL NOT NULL DEFAULT 1.00,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return dbInstance;
}

/**
 * Create a new order
 */
export async function createOrder(walletAddress: string, amount: number = 1.0): Promise<Order> {
  const db = await getDb();
  const id = Math.random().toString(36).substring(7);
  const normalizedAddress = walletAddress.toLowerCase().trim();

  await db.run(
    'INSERT INTO orders (id, wallet_address, amount_musd, status) VALUES (?, ?, ?, ?)',
    [id, normalizedAddress, amount, 'pending']
  );

  const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  return order as Order;
}

/**
 * Retrieve an order
 */
export async function getOrder(id: string): Promise<Order | undefined> {
  const db = await getDb();
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  return order as Order;
}

/**
 * Record a raw webhook payload
 */
export async function logWebhook(payload: any) {
  const db = await getDb();
  await db.run(
    'INSERT INTO webhook_logs (payload) VALUES (?)',
    [JSON.stringify(payload)]
  );
}

/**
 * Get latest webhook logs
 */
export async function getWebhookLogs(limit: number = 20) {
  const db = await getDb();
  return await db.all('SELECT * FROM webhook_logs ORDER BY received_at DESC LIMIT ?', [limit]);
}

/**
 * Update order via Webhook (Matches latest pending order for address)
 */
export async function updateOrderByWallet(walletAddress: string, status: OrderStatus, hash?: string) {
  const db = await getDb();
  const normalizedAddress = walletAddress.toLowerCase().trim();
  
  // Find the latest pending order for this wallet
  const order = await db.get(
    'SELECT id FROM orders WHERE LOWER(wallet_address) = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
    [normalizedAddress, 'pending']
  );

  if (!order) {
    console.warn(`[SQLite] No pending order found for: ${normalizedAddress}`);
    return null;
  }

  await db.run(
    'UPDATE orders SET status = ?, transaction_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, hash || null, order.id]
  );

  return await db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
}
