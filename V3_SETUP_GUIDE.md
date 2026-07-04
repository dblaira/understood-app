# V3 Setup Guide

Complete step-by-step guide to set up all V3 features.

## Prerequisites

- ✅ Next.js app is running locally
- ✅ Supabase project is set up
- ✅ Environment variables are configured

## Step 1: Database Migrations

### Option A: Supabase Dashboard (Recommended)

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `database-migrations.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)

### Option B: Supabase CLI

```bash
supabase db push database-migrations.sql
```

### Verify Migration

After running the migrations, verify the tables exist:

```sql
-- Check weekly_themes table
SELECT * FROM weekly_themes LIMIT 1;

-- Check entries table has new columns
SELECT photo_url, photo_processed, week_theme_id FROM entries LIMIT 1;
```

If you get errors, the migrations likely didn't run. Check the SQL Editor for error messages.

## Step 2: Storage Bucket Setup

### Option A: Supabase Dashboard (Recommended)

1. Open Supabase Dashboard
2. Navigate to **Storage**
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `entry-photos`
   - **Public bucket**: ✅ Checked (or configure RLS policies)
   - **File size limit**: `10485760` (10MB)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/webp`
5. Click **Create bucket**

### Option B: Using Script

1. Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env.local`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
   (Find this in Supabase Dashboard → Settings → API)

2. Run the script:
   ```bash
   npm run setup:storage
   ```

### Storage Policies (If Using RLS)

If you set the bucket to **private**, you'll need to add RLS policies:

1. Go to Storage → Policies
2. Create policies for `entry-photos` bucket:

**Policy 1: Users can upload to their own folder**
```sql
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'entry-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Policy 2: Users can read from their own folder**
```sql
CREATE POLICY "Users can read own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'entry-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Policy 3: Users can delete their own photos**
```sql
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'entry-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Step 3: Verify Setup

Run the verification script to check everything is configured:

```bash
npm run setup:verify
```

Or directly:
```bash
node scripts/setup-verification.js
```

This will check:
- ✅ Environment variables are set
- ✅ Database tables exist
- ✅ Storage bucket exists

## Step 4: Test Features

### Test Weekly Theme Generation

1. Create at least 7 journal entries
2. Look for the "✨ Generate Weekly Theme" button
3. Click it and wait for generation (takes ~10-15 seconds)
4. Verify the weekly theme banner appears

### Test Photo Upload

1. Click "+ New Entry"
2. Fill in the entry form
3. Click "Choose File" under "Photo (optional)"
4. Select an image file (JPEG, PNG, or WebP)
5. Verify the preview appears
6. Submit the entry
7. Verify the photo displays in the entry card

### Test PDF Export

1. Open any entry (click "Read")
2. Click "📄 Export PDF" button
3. Verify PDF downloads with entry content

### Test Nightly Generation (Manual)

The cron job runs automatically at 2 AM, but you can test it manually:

```bash
# Get your CRON_SECRET from .env.local
curl -X GET http://localhost:3000/api/cron/generate-nightly \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or use a tool like Postman/Insomnia with:
- Method: GET
- URL: `http://localhost:3000/api/cron/generate-nightly`
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

## Troubleshooting

### Database Errors

**Error: "relation weekly_themes does not exist"**
- Solution: Run `database-migrations.sql` in Supabase SQL Editor

**Error: "column photo_url does not exist"**
- Solution: Run `database-migrations.sql` to add new columns to entries table

### Storage Errors

**Error: "Bucket not found"**
- Solution: Create `entry-photos` bucket in Supabase Dashboard → Storage

**Error: "Permission denied"**
- Solution: Check storage bucket policies or set bucket to public

**Error: "File size too large"**
- Solution: Ensure bucket file size limit is set to at least 10MB

### API Errors

**Error: "API key not configured"**
- Solution: Set `ANTHROPIC_API_KEY` in `.env.local`

**Error: "Unauthorized" in cron endpoint**
- Solution: Set `CRON_SECRET` in `.env.local` and use it in Authorization header

### Photo Upload Errors

**Error: "Invalid file type"**
- Solution: Only JPEG, PNG, and WebP are supported

**Error: "Failed to upload photo"**
- Solution: Check storage bucket exists and has correct permissions

## Environment Variables Checklist

Ensure these are set in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Optional, for scripts

# Anthropic AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# Cron
CRON_SECRET=your_random_secret_here

# Site URL (for server actions)
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Or your production URL
```

## Next Steps

After setup is complete:

1. ✅ Test all features locally
2. ✅ Deploy to Vercel
3. ✅ Add environment variables in Vercel dashboard
4. ✅ Verify cron job runs (check Vercel logs at 2 AM)
5. ✅ Test features in production

## Support

If you encounter issues:

1. Check `V3_IMPLEMENTATION.md` for detailed feature documentation
2. Run `npm run setup:verify` to check configuration
3. Check Supabase logs in Dashboard → Logs
4. Check Vercel logs for deployment issues

## Success Checklist

- [ ] Database migrations run successfully
- [ ] `entry-photos` storage bucket created
- [ ] Verification script passes all checks
- [ ] Weekly theme generation works
- [ ] Photo upload works
- [ ] PDF export works
- [ ] Cron job can be called manually (or wait for 2 AM)

Once all items are checked, V3 features are fully operational! 🎉

