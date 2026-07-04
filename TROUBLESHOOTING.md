# Troubleshooting Guide

## Issue 1: Can't Login on localhost:3000

### Possible Causes:
1. **Environment variables not loaded**
   - Check that `.env.local` exists in project root
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are set
   - Restart dev server after adding/changing env vars

2. **Supabase project not active**
   - Check Supabase Dashboard to ensure project is active
   - Verify the URL and keys match your project

3. **Browser cache issues**
   - Clear browser cache
   - Try incognito/private mode
   - Check browser console for errors

### Fix Steps:
```bash
# 1. Verify .env.local exists
ls -la .env.local

# 2. Check environment variables are set
cat .env.local | grep SUPABASE

# 3. Restart dev server
# Stop current server (Ctrl+C) then:
npm run dev
```

### Check Browser Console:
- Open DevTools (F12)
- Look for errors in Console tab
- Check Network tab for failed requests

## Issue 2: "Generate Weekly Theme" Button Not Showing

### Possible Causes:
1. **Weekly theme already exists for current week**
   - Check if a theme was already generated this week
   - The button only shows when NO weekly theme exists

2. **Less than 7 entries**
   - Button requires exactly 7+ entries
   - Check entry count in debug info (development mode)

3. **Button is hidden by styling**
   - Check browser DevTools to see if element exists but is hidden
   - Look for the debug info box (development mode only)

### Fix Steps:

**Check if theme exists:**
1. Open browser DevTools (F12)
2. Look for debug info box showing entry count and theme status
3. If theme exists, you'll see "Weekly theme: exists"

**Check entry count:**
- Debug info shows: "Debug: X entries"
- Need 7+ entries to see button

**Force show button (for testing):**
- Temporarily change condition in `components/journal-page-client.tsx`:
  ```typescript
  {entries.length >= 1 && !weeklyTheme && (  // Changed from 7 to 1 for testing
  ```

**Delete existing weekly theme:**
- Go to Supabase Dashboard → Table Editor → `weekly_themes`
- Delete the theme for current week
- Refresh page

## Debug Mode

In development, you'll see a debug box showing:
- Entry count
- Weekly theme status

This helps identify why the button isn't showing.

## Common Solutions

### Restart Dev Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Clear Browser Cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Or clear cache in browser settings

### Check Environment Variables
```bash
# Verify .env.local has all required vars
cat .env.local
```

### Check Supabase Connection
- Verify project is active in Supabase Dashboard
- Check API keys match your project
- Verify RLS policies allow access

## Still Having Issues?

1. Check browser console for errors
2. Check terminal for server errors
3. Verify all environment variables are set
4. Check Supabase Dashboard → Logs for database errors
5. Try logging out and back in

