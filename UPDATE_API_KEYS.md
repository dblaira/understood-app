# Update Supabase API Keys

Supabase has updated their API key format. You need to update your environment variables.

## New Key Format

Supabase now uses shorter keys:
- **Publishable key**: `sb_publishable_...` (replaces old `anon` key)
- **Secret key**: `sb_secret_...` (replaces old `service_role` key)

## Steps to Update

### 1. Get Your New Keys from Supabase

1. Go to Supabase Dashboard → Settings → API Keys
2. Copy the **Publishable key** (`sb_publishable_...`)
3. Click the eye icon next to the **Secret key** (`sb_secret_...`) to reveal it
4. Copy the full **Secret key**

### 2. Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update these variables:

   **Replace:**
   ```
   SUPABASE_PUBLISHABLE_KEY=<SUPABASE_PUBLISHABLE_KEY> (old long JWT)
   ```

   **With:**
   ```
   SUPABASE_PUBLISHABLE_KEY=<SUPABASE_PUBLISHABLE_KEY> (new format)
   ```

   **Add/Update:**
   ```
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xf_9L... (new secret key - full value)
   ```

### 3. Update Local .env.local (Optional)

If you're testing locally, update your `.env.local` file with the new keys.

### 4. Redeploy

After updating environment variables in Vercel, trigger a new deployment.

## Important Notes

- The new keys are **shorter** than the old JWT format - this is normal!
- The **Secret key** (`sb_secret_...`) is what you need for `SUPABASE_SERVICE_ROLE_KEY`
- The **Publishable key** (`sb_publishable_...`) is what you need for `SUPABASE_PUBLISHABLE_KEY`
- Both keys should start with `sb_` prefix

## Verification

After updating, photo uploads should work without RLS errors.

