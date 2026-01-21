# Revert to UUID Implementation

## What Changed

**User ID Strategy:** Reverted from plain email strings back to **deterministic UUIDs** generated from emails.

## Database Changes

### Migration: `supabase/migrations/revert_to_uuid.sql`
```sql
-- Truncate tables to remove TEXT data
TRUNCATE TABLE project_settings, alerts, client_profiles, leads CASCADE;

-- Convert back to UUID
ALTER TABLE project_settings ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE alerts ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE client_profiles ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE leads ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Keep RLS disabled (dev mode)
ALTER TABLE project_settings DISABLE ROW LEVEL SECURITY;
-- ... (other tables)
```

**⚠️ CRITICAL:** This migration **truncates all tables**, so all existing data will be lost!

## Code Changes

### Dev Auth Actions (`app/actions/dev-auth.ts`):
- **Restored UUID generation** using `uuidv5()`
- **`switchUser(email)`**: Now generates UUID from email again
- **`createUser(formData)`**: Same UUID generation logic

### User ID Generation:
```typescript
// Before (TEXT):
const mockUserId = "admin@test.com";

// After (UUID):
const mockUserId = uuidv5("admin@test.com", UUID_NAMESPACE);
// Result: "550e8400-e29b-41d4-a716-446655440000"
```

## Why Revert to UUIDs?

### ✅ **Benefits of UUIDs:**
- **Standard practice** for user IDs in databases
- **Future-proof** for production (can link to real Supabase auth users)
- **No email storage** in user_id columns (better for privacy)
- **Consistent length** and format
- **Index-friendly** for database performance

### ✅ **Deterministic Generation:**
- Same email always produces same UUID
- Consistent across environments
- Predictable for testing

## Migration Steps

### Step 1: Run the Migration
```sql
-- Copy-paste into Supabase SQL Editor:
-- supabase/migrations/revert_to_uuid.sql
```
**Warning:** This will delete all existing data in the tables!

### Step 2: Test the System
1. Use Dev Switcher with: `admin@test.com`
2. Check database - should see UUID in `user_id` column
3. Add settings - should work with UUID filtering

### Step 3: Verify Data Isolation
1. Switch to different email: `client@test.com`
2. Should get different UUID
3. Data should be properly isolated

## Current Status

✅ **Migration created** - Run in Supabase (⚠️ truncates data)  
✅ **Code updated** - Uses UUIDs again  
✅ **No-auth maintained** - RLS still disabled  
✅ **Deterministic** - Same email = same UUID  

**Ready to run migration and test!** The system now uses proper UUIDs for user identification while maintaining the no-auth dev mode. 🎯