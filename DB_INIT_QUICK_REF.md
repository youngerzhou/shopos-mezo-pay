# Database Initialization - Quick Reference

## 🚀 Usage

### Development
```bash
# Start dev server (auto-initializes on first request)
npm run dev

# Test initialization performance
npm run db:test-init
```

### Production
```bash
# Step 1: Run explicit migration (required before deployment)
npm run db:migrate

# Step 2: Set environment variable to skip runtime checks
export SKIP_DB_INIT=true

# Step 3: Start application
npm start
```

**Vercel/Cloud Deployment**:
Add `SKIP_DB_INIT=true` to your environment variables in the deployment platform.

## 📊 What Changed?

### Before
- ❌ Every API call: Schema check (~100-500ms)
- ❌ Page refreshes: Multiple schema checks
- ❌ Slow development startup
- ❌ Serverless cold starts repeat checks

### After
- ✅ First request: One-time migration (~50-200ms)
- ✅ Subsequent requests: 0ms (fast path)
- ✅ Fast development startup
- ✅ **Production with SKIP_DB_INIT=true: Zero runtime overhead**

## 🔍 How to Verify

### Check Logs

**With SKIP_DB_INIT=false (default)**:
```
[DB Init] start
[DB Init] Environment: production
[DB Init] Skipping migration 001_init_schema (already applied)
[DB Init] All migrations already applied, skipping
[DB Init] completed in 45ms
```

**With SKIP_DB_INIT=true (production optimized)**:
```
[DB Init] Skipped runtime migration check because SKIP_DB_INIT=true
```

### Run Performance Test
```bash
npm run db:test-init
```

Expected output:
```
Test 1: First initialization
✅ First init completed in 150ms

Test 2: Second call (should use fast path)
✅ Second call completed in 1ms
✅ Fast path working correctly (< 5ms)

Test 3: Concurrent calls (should share same promise)
✅ 5 concurrent calls completed in 2ms

🎉 All tests passed!
```

## 🛠️ Adding New Migrations

Edit `src/app/lib/db.ts` and add to the `migrations` array:

```typescript
{
  id: '005_your_migration',
  description: 'Description of what this migration does',
  run: async () => {
    console.log('[DB Init] Applying migration: 005_your_migration');
    
    // Your migration logic here
    await sql`ALTER TABLE ...`;
    
    console.log('[DB Init] Migration 005 applied successfully');
  }
}
```

## ⚠️ Important Notes

### Safety
- ✅ Never deletes existing data
- ✅ Idempotent (safe to run multiple times)
- ✅ Preserves all existing structures
- ✅ Clear error messages on failure

### Production Deployment Workflow

**Option 1: With SKIP_DB_INIT (Recommended for Vercel/Serverless)**
```bash
# 1. Deploy code
git push origin main

# 2. Run migration explicitly (via CI/CD or manually)
npm run db:migrate

# 3. Set SKIP_DB_INIT=true in environment variables
# Vercel: Settings → Environment Variables → Add SKIP_DB_INIT=true
# Or in .env.production: SKIP_DB_INIT=true

# 4. Application starts with zero DB init overhead
```

**Option 2: Without SKIP_DB_INIT (Traditional)**
```bash
# 1. Deploy code
git push origin main

# 2. Application auto-initializes on first request
# (Still safe due to IF NOT EXISTS and schema_migrations table)
```

### Troubleshooting

**Migration fails:**
- Check `[DB Init] failed:` error message
- Review database connection (DATABASE_URL)
- Verify permissions

**APIs fail after setting SKIP_DB_INIT=true:**
- This means database was not migrated
- Solution: Run `npm run db:migrate` first
- Then restart application with SKIP_DB_INIT=true

**Want to re-run migrations:**
```sql
-- WARNING: Only in development!
DROP TABLE schema_migrations;
```

**Check applied migrations:**
```sql
SELECT * FROM schema_migrations ORDER BY id;
```

## 📈 Performance Metrics

| Scenario | Before | After (default) | After (SKIP_DB_INIT=true) |
|----------|--------|-----------------|---------------------------|
| First request | 100-500ms | 50-200ms | 0ms |
| Subsequent requests | 100-500ms | <5ms | 0ms |
| Dev server startup | Slow | Fast | N/A |
| Serverless cold start | 100-500ms | 50-100ms | **0ms** |
| Concurrent requests | N×overhead | Shared | Shared |

## 🔗 Related Files

- **Core Logic**: `src/app/lib/db.ts`
- **Migration Script**: `scripts/db-migrate.ts`
- **Test Script**: `scripts/test-db-init.ts`
- **Full Documentation**: `DATABASE_INIT_OPTIMIZATION.md`

## 🌐 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Required | PostgreSQL connection string |
| `SKIP_DB_INIT` | `false` | Skip runtime migration checks in production |
| `NODE_ENV` | Auto | `development` or `production` |

**Important**: `SKIP_DB_INIT=true` only works in production mode (`NODE_ENV=production`). In development, auto-initialization always runs regardless of this flag.
