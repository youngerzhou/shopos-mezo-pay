/**
 * Database Migration Script
 * Run this explicitly in production: npm run db:migrate
 * This script ALWAYS runs migrations regardless of SKIP_DB_INIT environment variable.
 */

import { ensureDb } from '../src/app/lib/db';

async function main() {
  console.log('🚀 Starting database migration...');
  
  // Temporarily disable SKIP_DB_INIT to ensure migrations run
  const originalSkipInit = process.env.SKIP_DB_INIT;
  if (process.env.SKIP_DB_INIT === 'true') {
    console.log('[DB Migrate] Temporarily disabling SKIP_DB_INIT for explicit migration');
    delete process.env.SKIP_DB_INIT;
  }
  
  const startTime = Date.now();

  try {
    await ensureDb();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Database migration completed successfully in ${duration}ms`);
    
    // Restore original SKIP_DB_INIT value
    if (originalSkipInit) {
      process.env.SKIP_DB_INIT = originalSkipInit;
      console.log('[DB Migrate] Restored SKIP_DB_INIT environment variable');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

main();
