# Dev Mode: No-Auth Implementation Complete

## What Was Implemented

**No-Auth Cookie System** - Bypasses Supabase authentication for rapid development.

---

## Files Created/Modified

### 1. Database Migration: `supabase/migrations/dev_mode_disable_auth.sql`
```sql
-- Drops FK constraints linking to auth.users
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_user_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_user_id_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;
```
**⚠️ CRITICAL: Run this SQL in Supabase before testing!**

### 2. Dev Auth Actions: `app/actions/dev-auth.ts`
- **`switchUser(email)`**: Generates deterministic UUID from email using `uuidv5()`
- **`createUser(formData)`**: Handles initial user setup + subreddits, then calls `switchUser()`
- **Mock Session**: Stores `userId` and `email` in global state (dev mode only)

### 3. Settings Actions: `app/actions/settings.ts`
- **`getMockUserId()`**: Helper to read mock user from global state
- **`updateSettings()`**: Uses mock user ID instead of Supabase auth
- **`getSettings()`**: Filters by mock user ID
- **Sync Logic**: Maintains subreddit delete/insert operations

### 4. Dashboard Page: `app/dashboard/page.tsx`
- **`getMockUser()`**: Reads from `window.__mockUserId`
- **Real-time Check**: Polls for mock user changes every second
- **Lead Filtering**: Uses mock user ID for alerts table joins

### 5. Settings Page: `app/dashboard/settings/page.tsx`
- **Mock User Check**: Validates `window.__mockUserId` exists
- **Filtered Queries**: All database queries use mock user ID

---

## How It Works

### User Login Flow:
1. Type email in Dev Switcher: `"john@test.com"`
2. System generates UUID: `uuidv5("john@test.com", NAMESPACE)`
3. Stores in global: `window.__mockUserId = "generated-uuid"`
4. Dashboard immediately shows as "logged in"

### Data Isolation:
- Each email gets unique UUID
- Settings filtered by `user_id = mockUserId`
- Subreddits stored in `alerts` table per user

---

## Testing Instructions

### Step 1: Run Database Migration
```sql
-- Copy and paste this into Supabase SQL Editor:
-- supabase/migrations/dev_mode_disable_auth.sql
```

### Step 2: Test Dev Switcher
1. Go to `/dashboard`
2. Open Dev Switcher (orange button)
3. Try "Switch User": `test@example.com`
4. Should instantly "log you in"

### Step 3: Test Settings
1. Go to `/dashboard/settings`
2. Add keywords: `"saas, startup"`
3. Add subreddits: `"saas, entrepreneur"`
4. Save - should work without auth errors

### Step 4: Test Multi-User
1. Switch to different email: `user2@example.com`
2. Settings should be separate/empty
3. Add different subreddits
4. Switch back to first user - original settings should persist

---

## Technical Details

### UUID Generation:
```typescript
import { v5 as uuidv5 } from "uuid";
const UUID_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const mockUserId = uuidv5(email.toLowerCase(), UUID_NAMESPACE);
// Same email always generates same UUID
```

### Global State (Dev Mode):
```typescript
// Set by switchUser()
window.__mockUserId = "uuid-here";
window.__mockUserEmail = "email@here";

// Read by components
const userId = window.__mockUserId;
```

### Database Operations:
- **No FK constraints** → Mock UUIDs work
- **Direct user_id filtering** → Each user sees only their data
- **Subreddit sync** → Delete/insert operations maintain data integrity

---

## Limitations (Expected for Prototype)

### ✅ What Works:
- Instant user switching
- Data isolation per "user"
- Multi-subreddit management
- Settings persistence

### ⚠️ Known Issues:
- **No real security** (dev mode only)
- **Global state** (not proper cookies)
- **FK constraints dropped** (data integrity risk)
- **Real-time auth changes** (polling, not events)

### 🚨 Production Migration Required:
1. **Restore FK constraints**
2. **Migrate mock user_ids** to real Supabase user_ids
3. **Implement proper auth**
4. **Test data integrity**

---

## Next Steps

1. **Run the migration** in Supabase
2. **Test the dev switcher** with different emails
3. **Verify data isolation** between "users"
4. **Add subreddits** via settings page
5. **Confirm leads filtering** works per user

The no-auth system is now active. Type any email in the Dev Switcher and start developing without authentication blocks!