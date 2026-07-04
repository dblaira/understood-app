# V3 Setup Quick Reference

Quick checklist for setting up V3 features.

## 🚀 Quick Setup (5 minutes)

### 1. Database Migrations
```bash
# Copy SQL from database-migrations.sql
# Paste into Supabase Dashboard → SQL Editor → Run
```

### 2. Storage Bucket
```bash
# Option A: Supabase Dashboard → Storage → New bucket → "entry-photos"
# Option B: npm run setup:storage (requires SUPABASE_SERVICE_ROLE_KEY)
```

### 3. Verify
```bash
npm run setup:verify
```

## ✅ Verification Checklist

- [ ] `weekly_themes` table exists
- [ ] `entries` table has `photo_url`, `photo_processed`, `week_theme_id` columns
- [ ] `entry-photos` storage bucket exists
- [ ] Environment variables set (see below)
- [ ] Can generate weekly theme (7+ entries)
- [ ] Can upload photos
- [ ] Can export PDFs

## 🔑 Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
ANTHROPIC_API_KEY=...
CRON_SECRET=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # or production URL
```

## 📚 Documentation

- **Full Setup Guide**: `V3_SETUP_GUIDE.md`
- **Feature Documentation**: `V3_IMPLEMENTATION.md`
- **Quick Start**: `QUICKSTART.md`

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "weekly_themes does not exist" | Run database-migrations.sql |
| "Bucket not found" | Create entry-photos bucket |
| "Permission denied" | Check storage policies |
| "API key not configured" | Set ANTHROPIC_API_KEY |

## 🎯 Test Commands

```bash
# Verify setup
npm run setup:verify

# Test cron manually (replace YOUR_SECRET)
curl -X GET http://localhost:3000/api/cron/generate-nightly \
  -H "Authorization: Bearer YOUR_SECRET"
```

## 📞 Need Help?

1. Check `V3_SETUP_GUIDE.md` for detailed steps
2. Run `npm run setup:verify` to diagnose issues
3. Check Supabase Dashboard → Logs for errors

