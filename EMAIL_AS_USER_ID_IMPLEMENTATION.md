# Email as User ID Implementation

## What Changed

**User ID Strategy:** Switched from UUID generation to using **raw email addresses** as user IDs for better dev mode readability.

---

## Changes Made

### 1. Database Migration: `supabase/migrations/convert_ids_to_text.sql`
```sql
-- Convert user_id columns from UUID to TEXT
ALTER TABLE project_settings ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE alerts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE client_profiles ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE leads ALTER COLUMN user_id TYPE TEXT;
```
**⚠️ CRITICAL:** Run this SQL in Supabase before testing!

### 2. Dev Auth Actions: `app/actions/dev-auth.ts`
- **Removed UUID import and namespace**
- **`switchUser(email)`**: Now uses `email.toLowerCase()` directly as user ID
- **`createUser(formData)`**: Same logic - raw email becomes user ID

### 3. Global State Storage
- `window.__mockUserId = "admin@test.com"` (instead of UUID)
- `window.__mockUserEmail = "admin@test.com"`

---

## How It Works Now

### Before (UUID):
```
Email: "admin@test.com"
↓
UUID: "550e8400-e29b-41d4-a716-446655440000"
↓
Database: user_id = "550e8400-e29b-41d4-a716-446655440000"
```

### After (Email):
```
Email: "admin@test.com"
↓
User ID: "admin@test.com"
↓
Database: user_id = "admin@test.com"
```

---

## Benefits

### ✅ **Dev Experience:**
- **Readable IDs:** See actual emails in database instead of cryptic UUIDs
- **Easy debugging:** Know exactly which user owns which data
- **Simple queries:** Can query by email directly: `WHERE user_id = 'admin@test.com'`

### ✅ **Consistency:**
- **Deterministic:** Same email always gives same user ID
- **No collisions:** Email uniqueness prevents conflicts
- **Reversible:** Easy to change back to UUIDs later

### ✅ **Database:**
- **TEXT type:** Can store any string format
- **Flexible:** Supports emails, usernames, or other identifiers
- **Indexing:** TEXT columns work fine with indexes

---

## Testing

### Step 1: Run Migration
```sql
-- Copy and paste into Supabase SQL Editor:
supabase/migrations/convert_ids_to_text.sql
```

### Step 2: Test Dev Switcher
1. Go to `/dashboard`
2. Use Dev Switcher with: `admin@test.com`
3. Check database - `project_settings` should show:
   ```
   user_id: "admin@test.com"
   ```

### Step 3: Test Multiple Users
1. Switch to: `client@test.com`
2. Add settings
3. Check database - should see both users:
   ```
   user_id: "admin@test.com"
   user_id: "client@test.com"
   ```

### Step 4: Test Settings Isolation
1. Switch between users
2. Each should see only their own settings
3. Database queries filter by email string

---

## Technical Details

### User ID Generation:
```typescript
// Before:
const mockUserId = uuidv5(cleanEmail, UUID_NAMESPACE);

// After:
const mockUserId = cleanEmail; // "admin@test.com"
```

### Database Queries:
```sql
-- Works with email strings:
SELECT * FROM project_settings WHERE user_id = 'admin@test.com';
SELECT * FROM alerts WHERE user_id = 'client@test.com';
```

### Backward Compatibility:
- **Existing data:** UUIDs will still work (TEXT can store UUIDs)
- **New data:** Uses email strings
- **Mixed data:** Database handles both formats

---

## Production Considerations

### When Going Live:
1. **Decide on ID strategy:**
   - Keep emails as user IDs (simplest)
   - Migrate to UUIDs (more secure)
   - Use Supabase user IDs (most secure)

2. **If migrating to UUIDs:**
   - Add new `uuid_user_id` column
   - Map email → real Supabase user ID
   - Update all references
   - Drop old `user_id` column

3. **If keeping emails:**
   - Add unique constraint on `user_id`
   - Consider email normalization (lowercase, trim)
   - Add email validation

---

## Current Status

✅ **Migration created**
✅ **Code updated to use email strings**
✅ **Global state uses email strings**
✅ **Database queries work with emails**

**Ready to test!** Type any email in the Dev Switcher and see readable user IDs in your database! 🎯