/**
 * Database Migration Script
 * Run this explicitly in production: npm run db:migrate
 */

import { ensureDb } from '../src/app/lib/db';

async function main() {
  console.log('🚀 Starting database migration...');
  const startTime = Date.now();

  try {
    await ensureDb();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Database migration completed successfully in ${duration}ms`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

main();
