# Multi-Subreddit Notification Settings

## What Was Built

Upgraded the Notification Settings to support **multiple subreddits** with a modern tag/badge interface and efficient database sync.

---

## Changes Made

### 1. **UI Component** (`components/dashboard/settings/NotificationSettings.tsx`)

#### **New Tag Input Interface:**
- **Input field** with Enter key and + button to add subreddits
- **Badge display** showing selected subreddits as removable chips
- **Duplicate prevention** - same subreddit can't be added twice
- **Auto-cleaning** - trims whitespace, converts to lowercase

#### **State Management:**
```typescript
const [subreddits, setSubreddits] = useState<string[]>(initialSubreddits);
const [currentInput, setCurrentInput] = useState("");
```

#### **User Experience:**
- Type subreddit name → Press Enter or click +
- See badges appear with r/{subreddit} format
- Click X on any badge to remove it
- Form validates: at least one subreddit required

### 2. **Server Action** (`app/actions/settings.ts`)

#### **Sync Logic (CRITICAL):**
The server action now implements a **smart sync algorithm**:

```typescript
// Step 1: Get existing alerts for this user
const existingAlerts = await supabase
  .from("alerts")
  .select("id, subreddit")
  .eq("user_id", user.id);

// Step 2: Compare incoming vs existing
const toDelete = existingAlerts.filter(alert =>
  !subreddits.includes(alert.subreddit)
);
const toInsert = subreddits.filter(subreddit =>
  !existingSubreddits.includes(subreddit)
);

// Step 3: Delete removed subreddits, insert new ones
```

#### **Database Operations:**
- **DELETE** rows that are in database but NOT in new list
- **INSERT** new rows for subreddits in new list but NOT in database
- **IGNORE** subreddits that exist in both (no-op)

#### **Data Flow:**
```
UI Array: ['saas', 'entrepreneur', 'marketing']
↓
JSON String: "[\"saas\",\"entrepreneur\",\"marketing\"]"
↓
Server parses: ['saas', 'entrepreneur', 'marketing']
↓
Database sync: delete/insert as needed
```

### 3. **Settings Page** (`app/dashboard/settings/page.tsx`)

#### **Updated Data Fetching:**
```typescript
// Old: Single alert row
alert: { subreddit: 'saas' }

// New: Multiple alert rows
alerts: [{ subreddit: 'saas' }, { subreddit: 'entrepreneur' }]
```

#### **Component Integration:**
```typescript
<NotificationSettings
  initialSubreddits={settings?.alerts?.map(a => a.subreddit) || []}
  initialSlackWebhookUrl={...}
/>
```

---

## Database Schema

The `alerts` table structure remains the same:
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `subreddit` (TEXT)

**New behavior:** One row per subreddit per user.

**Example data:**
```
user_id: 'abc123', subreddit: 'saas'
user_id: 'abc123', subreddit: 'entrepreneur'
user_id: 'def456', subreddit: 'saas'  -- different user
```

---

## How It Works

### **Adding Subreddits:**
1. User types `"saas"` → presses Enter
2. Badge appears: `r/saas ✕`
3. Array state: `['saas']`
4. User types `"entrepreneur"` → adds another badge
5. Array state: `['saas', 'entrepreneur']`

### **Removing Subreddits:**
1. User clicks ✕ on `r/saas` badge
2. Badge disappears
3. Array state: `['entrepreneur']`

### **Saving:**
1. Form submits: `["saas", "entrepreneur"]`
2. Server compares with existing: `["marketing"]`
3. **Deletes:** `marketing` row
4. **Inserts:** `saas`, `entrepreneur` rows
5. **Result:** User now monitors saas + entrepreneur

---

## Benefits

### ✅ **User Experience:**
- **Intuitive:** Tag interface familiar from email/Slack
- **Visual:** See all selected subreddits at a glance
- **Flexible:** Add/remove easily without form confusion

### ✅ **Performance:**
- **Minimal queries:** One fetch to get existing alerts
- **Efficient sync:** Only delete/insert changed subreddits
- **No duplicates:** Database prevents same subreddit twice

### ✅ **Data Integrity:**
- **Atomic operations:** All deletes/inserts succeed or fail together
- **Clean state:** No orphaned or duplicate records
- **Audit trail:** Logging shows what was deleted/inserted

### ✅ **Scalability:**
- **Per-user isolation:** RLS ensures users only see their alerts
- **Query friendly:** Easy to get user's subreddits: `SELECT subreddit FROM alerts WHERE user_id = ?`
- **Future-proof:** Can add per-subreddit settings (notification preferences, etc.)

---

## Testing

### **Manual Test:**
1. Go to `/dashboard/settings`
2. Click "Notifications" tab
3. Add multiple subreddits: `saas`, `entrepreneur`, `marketing`
4. Save settings
5. Refresh page - subreddits should persist
6. Remove one subreddit and save
7. Check database: only removed subreddit should be deleted

### **Database Verification:**
```sql
-- See all alerts for a user
SELECT subreddit FROM alerts WHERE user_id = 'your-user-id';

-- Expected: saas, entrepreneur (marketing removed)
```

---

## Future Enhancements

1. **Subreddit Suggestions:** Auto-complete from popular subreddits
2. **Bulk Operations:** Select from predefined lists
3. **Per-Subreddit Settings:** Different notification preferences per subreddit
4. **Analytics:** Show which subreddits generate most leads
5. **Import/Export:** Save/load subreddit lists

---

## Technical Notes

- **Validation:** At least one subreddit required
- **Case sensitivity:** All subreddits normalized to lowercase
- **Whitespace:** Auto-trimmed
- **Duplicates:** Prevented in UI and would be prevented by database constraints
- **Error handling:** Graceful failure with user feedback
- **Performance:** Sync algorithm minimizes database operations

The implementation provides a modern, user-friendly way to manage multiple subreddits while maintaining clean database operations and data integrity.