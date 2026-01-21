# Global Subreddits Setup

## What Was Built

A system to allow users to add multiple subreddits when creating test accounts, with all subreddits saved to a global `subreddits` table in the database.

---

## Changes Made

### 1. **Database Migration** (`supabase/migrations/create_subreddits_table.sql`)

Created a new global `subreddits` table:
- `id` (UUID, primary key)
- `name` (TEXT, unique) - subreddit name without "r/"
- `created_at` and `updated_at` timestamps
- RLS enabled with public read/write access
- Automatic timestamp updates on changes
- Prevents duplicate entries

### 2. **DevUserSwitcher Component** (`components/dashboard/DevUserSwitcher.tsx`)

Updated the "Create User" form:
- Changed "Subreddit" to "Subreddits" (plural)
- Updated placeholder: `"saas, entrepreneur, startups"`
- Updated helper text: "Comma-separated subreddits to monitor (without r/)"

### 3. **Dev Auth Server Action** (`app/actions/dev-auth.ts`)

Updated `createUser()` function:
- Accepts comma-separated subreddit names
- Splits and cleans input (trims, lowercase, removes empty)
- **Inserts each subreddit into global `subreddits` table** using upsert (prevents duplicates)
- Also saves first subreddit to `alerts` table for compatibility
- Graceful error handling (logs errors but doesn't fail user creation)

---

## How It Works

### When Creating a User:

1. User enters email (required)
2. User enters subreddits like: `"saas, entrepreneur, startups"` (optional)
3. User optionally adds keywords and product description
4. Clicks "Create & Sign In"

### What Happens:

```
Input: "saas, entrepreneur, startups"
↓
Split & Clean: ["saas", "entrepreneur", "startups"]
↓
Insert into global `subreddits` table:
  - { name: "saas" }
  - { name: "entrepreneur" }
  - { name: "startups" }
↓
Also insert into `alerts` table:
  - { user_id: <userId>, subreddit: "saas" }
```

---

## Database Schema

```sql
CREATE TABLE subreddits (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Next Steps

### 1. **Run the Migration** (REQUIRED)

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Copy and paste contents of:
supabase/migrations/create_subreddits_table.sql
```

### 2. **Test the Feature**

1. Open the Dashboard
2. Use DevUserSwitcher → "Create User" tab
3. Enter: `test@example.com`
4. Enter subreddits: `saas, entrepreneur, startups`
5. Click "Create & Sign In"
6. Check Supabase → `subreddits` table to verify all 3 subreddits are saved

### 3. **Query Global Subreddits**

You can now query all subreddits across all users:

```sql
SELECT * FROM subreddits ORDER BY name;
```

This is useful for:
- Displaying a list of all monitored subreddits
- Analytics on which subreddits are popular
- Preventing duplicate scraping of the same subreddit

---

## Benefits

1. **No Duplicates**: Global table ensures each subreddit is only stored once
2. **Easy Analytics**: See all subreddits being monitored across all users
3. **Flexible Input**: Users can add 1 or many subreddits at once
4. **Backward Compatible**: Still saves to `alerts` table for existing features
5. **Clean Data**: Auto-trims whitespace and converts to lowercase

---

## Future Enhancements

- Add a UI to browse/search the global subreddits list
- Track which users are monitoring which subreddits (many-to-many relationship)
- Add subreddit metadata (subscriber count, description, last scraped, etc.)
- Implement subreddit suggestions based on popular choices
