# Vercel Deployment Guide

## Required Environment Variables

Add these environment variables in your Vercel project settings:

### Required Variables

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://xxxxx.supabase.co`
   - Must be set for the app to work

2. **SUPABASE_PUBLISHABLE_KEY**
   - Your Supabase anonymous/public key
   - Found in Supabase Dashboard > Settings > API
   - Must be set for the app to work

3. **ANTHROPIC_API_KEY**
   - Your Anthropic Claude API key
   - Get from: https://console.anthropic.com/
   - Required for AI version generation

4. **CRON_SECRET** (Optional for now)
   - Random secret string for cron job authentication
   - Generate a random string (e.g., `openssl rand -hex 32`)
   - Only needed when implementing V3 scheduled jobs

## How to Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Environment Variables**
3. Add each variable:
   - **Key**: Variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: Variable value
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your application for changes to take effect

## Common Deployment Issues

### Issue: Build Fails with "Missing Environment Variables"

**Solution**: Ensure all required environment variables are set in Vercel dashboard.

### Issue: Runtime Error - "Missing Supabase environment variables"

**Solution**: 
1. Check that `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are set
2. Make sure they're available for all environments (Production, Preview, Development)
3. Redeploy after adding variables

### Issue: API Routes Return 500 Errors

**Solution**:
1. Check that `ANTHROPIC_API_KEY` is set
2. Verify API key is valid and has credits
3. Check Vercel function logs for specific error messages

### Issue: Cron Jobs Not Working

**Solution**:
1. Ensure `CRON_SECRET` is set in Vercel environment variables
2. Verify `vercel.json` cron configuration is correct
3. Check Vercel Cron dashboard for job status

## Build Configuration

The project uses standard Next.js build configuration:

- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

No custom build configuration needed.

## Post-Deployment Checklist

- [ ] All environment variables are set in Vercel
- [ ] Application builds successfully
- [ ] Login/signup works
- [ ] Entries can be created
- [ ] AI version generation works
- [ ] Search and filtering work
- [ ] No console errors in browser

## Troubleshooting

### View Deployment Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the failed deployment
3. Check **Build Logs** and **Function Logs** for errors

### Test Locally Before Deploying

```bash
# Set environment variables locally
cp .env.example .env.local
# Edit .env.local with your values

# Test build
npm run build

# Test production build locally
npm run start
```

### Contact Support

If issues persist:
1. Check Vercel Status: https://www.vercel-status.com/
2. Review Next.js Deployment Docs: https://nextjs.org/docs/deployment
3. Check Vercel Community: https://github.com/vercel/vercel/discussions

