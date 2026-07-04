# Environment Variables Configuration Guide

## Required Environment Variables

### For Local Development (.env.local)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://wqdacfrzurhpsiuvzxwo.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Anthropic Claude API
ANTHROPIC_API_KEY=your_actual_anthropic_api_key_here

# Vercel Cron Secret (for scheduled jobs)
CRON_SECRET=your_actual_random_secret_here

# Site URL (for server actions)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### For Vercel Production

Add these in Vercel Dashboard → Project → Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wqdacfrzurhpsiuvzxwo.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ANTHROPIC_API_KEY=your_actual_anthropic_api_key_here
CRON_SECRET=your_actual_random_secret_here
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

## Current Issues Found

### In .env.local:
1. ❌ `ANTHROPIC_API_KEY=your-api-key-here` - Still placeholder, needs actual key
2. ❌ `CRON_SECRET=your_cron_secret_here` - Still placeholder, needs actual secret
3. ❌ Missing `NEXT_PUBLIC_SITE_URL` - Required for server actions

### In .env.example:
- ✅ Has correct structure but needs `NEXT_PUBLIC_SITE_URL` added

## How to Fix

### Step 1: Update .env.local

Open `.env.local` and replace:

1. **ANTHROPIC_API_KEY**: 
   - Get from: https://console.anthropic.com/
   - Replace `your-api-key-here` with your actual API key

2. **CRON_SECRET**:
   - Generate a random secret: `openssl rand -base64 32`
   - Or use any long random string
   - Replace `your_cron_secret_here` with the generated secret

3. **Add NEXT_PUBLIC_SITE_URL**:
   - Add this line: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

### Step 2: Update .env.example

Add `NEXT_PUBLIC_SITE_URL` to the example file for future reference.

### Step 3: Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update these variables:
   - `NEXT_PUBLIC_SUPABASE_URL` (should already be there)
   - `SUPABASE_PUBLISHABLE_KEY` (should already be there)
   - `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended)
   - `ANTHROPIC_API_KEY` (must be set with actual key)
   - `CRON_SECRET` (must be set with actual secret)
   - `NEXT_PUBLIC_SITE_URL` (set to your Vercel URL, e.g., `https://news-journal-app.vercel.app`)

3. **Important**: Make sure to set these for:
   - Production
   - Preview
   - Development (if using Vercel dev)

4. Redeploy after adding variables

## Verification

After updating, verify:

```bash
# Check local .env.local
cat .env.local | grep -v "^#" | grep "="

# Should show all variables with actual values (no placeholders)
```

## Notes

- `.env.local` is for local development only (not committed to git)
- Vercel environment variables are separate and must be set in dashboard
- `NEXT_PUBLIC_*` variables are exposed to the browser
- Other variables are server-only
- Never commit actual API keys to git

