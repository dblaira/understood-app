# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Set Up Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=your_actual_api_key_here
CRON_SECRET=generate_a_random_secret_here
```

The Supabase credentials are already filled in from your previous setup.

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### 3. Test the Application

1. **Login/Signup**: Go to `/login` and create an account or sign in
2. **Create Entry**: Click "+ New Entry" and create your first journal entry
3. **Generate Versions**: Click "✨ Generate Versions" on any entry to see AI-generated rewrites
4. **Search & Filter**: Use the search bar and category filters to find entries

## ✅ What's Working

- ✅ Authentication (login/signup/logout)
- ✅ Create, view, and delete entries
- ✅ AI version generation (4 styles)
- ✅ Search and category filtering
- ✅ Responsive design
- ✅ All existing functionality preserved

## 🐛 Troubleshooting

### Build Errors
- Make sure all environment variables are set in `.env.local`
- Run `npm install` to ensure all dependencies are installed

### Authentication Issues
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are correct
- Verify your Supabase project is active

### API Errors
- Ensure `ANTHROPIC_API_KEY` is set correctly
- Check that your Anthropic API key has credits/quota

## 📝 Next Steps

After testing locally:

1. **Deploy to Vercel**:
   - Push your code to GitHub
   - Import repository in Vercel
   - Add environment variables in Vercel dashboard
   - Deploy!

2. **Set up Vercel Cron** (for V3):
   - The cron endpoint is already configured in `vercel.json`
   - Add `CRON_SECRET` to Vercel environment variables
   - Cron will run nightly at 2 AM

## 🎉 Migration Complete!

Your app has been successfully migrated to Next.js 14 with TypeScript. All functionality is preserved and ready for V3/V4 features!

## 🚀 V3 Features Setup

After completing the basic setup above, follow these steps to enable V3 features:

### 1. Run Database Migrations

Open your Supabase Dashboard → SQL Editor and run the SQL from `database-migrations.sql`:

```sql
-- This creates the weekly_themes table and adds photo fields to entries
-- See database-migrations.sql for the full script
```

### 2. Create Storage Bucket

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name it `entry-photos`
4. Set to **Public** (or configure RLS policies)
5. Set file size limit to 10MB
6. Add allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

**Option B: Via Script**
```bash
# Set SUPABASE_SERVICE_ROLE_KEY in .env.local first
node scripts/create-storage-bucket.js
```

### 3. Verify Setup

Run the verification script to check everything is configured:

```bash
node scripts/setup-verification.js
```

### 4. Test V3 Features

1. **Weekly Theme**: Create 7+ entries, then click "Generate Weekly Theme"
2. **Photo Upload**: Create an entry with a photo attachment
3. **PDF Export**: Click "Export PDF" in any entry modal
4. **Nightly Generation**: The cron job runs automatically at 2 AM (or test manually)

See `V3_IMPLEMENTATION.md` for detailed documentation.

