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
# Step 1: Run explicit migration
npm run db:migrate

# Step 2: Start application
npm start
```

## 📊 What Changed?

### Before
- ❌ Every API call: Schema check (~100-500ms)
- ❌ Page refreshes: Multiple schema checks
- ❌ Slow development startup

### After
- ✅ First request: One-time migration (~50-200ms)
- ✅ Subsequent requests: 0ms (fast path)
- ✅ Fast development startup

## 🔍 How to Verify

### Check Logs
Look for these log messages in console:
```
[DB Init] start
[DB Init] Environment: development
[DB Init] Skipping migration 001_init_schema (already applied)
[DB Init] All migrations already applied, skipping
[DB Init] completed in 45ms
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

### Production Deployment
1. Deploy code to Vercel/production
2. SSH into server or use deployment hook
3. Run: `npm run db:migrate`
4. Restart application

### Troubleshooting

**Migration fails:**
- Check `[DB Init] failed:` error message
- Review database connection (DATABASE_URL)
- Verify permissions

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

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| First request | 100-500ms | 50-200ms | 60% faster |
| Subsequent requests | 100-500ms | <5ms | 95%+ faster |
| Dev server startup | Slow | Fast | Significant |
| Concurrent requests | N×overhead | Shared | 90%+ reduction |

## 🔗 Related Files

- **Core Logic**: `src/app/lib/db.ts`
- **Migration Script**: `scripts/db-migrate.ts`
- **Test Script**: `scripts/test-db-init.ts`
- **Full Documentation**: `DATABASE_INIT_OPTIMIZATION.md`
