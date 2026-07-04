#!/usr/bin/env node

/**
 * Complete V3 Setup Script
 * Guides you through completing all setup steps
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local')
  const envExamplePath = path.join(process.cwd(), '.env.example')
  
  if (!fs.existsSync(envPath)) {
    log('\n📝 Creating .env.local file...', 'blue')
    
    let envContent = ''
    if (fs.existsSync(envExamplePath)) {
      envContent = fs.readFileSync(envExamplePath, 'utf8')
    } else {
      envContent = `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# Cron Secret
CRON_SECRET=generate_a_random_secret_here

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
`
    }
    
    fs.writeFileSync(envPath, envContent)
    log('✅ Created .env.local file', 'green')
    log('   Please fill in your values and run this script again', 'yellow')
    return false
  }
  
  // Load env vars
  require('dotenv').config({ path: envPath })
  return true
}

async function step1DatabaseMigrations() {
  log('\n📊 Step 1: Database Migrations', 'cyan')
  log('=' .repeat(50), 'cyan')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    log('❌ Supabase credentials not found in .env.local', 'red')
    log('   Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', 'yellow')
    return false
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  log('\nChecking if weekly_themes table exists...', 'blue')
  const { error: themesError } = await supabase
    .from('weekly_themes')
    .select('id')
    .limit(1)
  
  if (themesError && themesError.code === '42P01') {
    log('❌ weekly_themes table does not exist', 'red')
    log('\n📋 To create the tables, you have two options:', 'yellow')
    log('\nOption A: Supabase Dashboard (Recommended)', 'blue')
    log('1. Open Supabase Dashboard → SQL Editor')
    log('2. Copy the contents of database-migrations.sql')
    log('3. Paste and click "Run"')
    
    log('\nOption B: Supabase CLI', 'blue')
    log('If you have Supabase CLI installed:')
    log('  supabase db push database-migrations.sql')
    
    const answer = await question('\nHave you run the migrations? (y/n): ')
    if (answer.toLowerCase() !== 'y') {
      log('⚠️  Please run the migrations and try again', 'yellow')
      return false
    }
    
    // Re-check
    const { error: recheckError } = await supabase
      .from('weekly_themes')
      .select('id')
      .limit(1)
    
    if (recheckError) {
      log('❌ Tables still not found. Please check your migrations.', 'red')
      return false
    }
  }
  
  log('✅ Database migrations complete', 'green')
  return true
}

async function step2StorageBucket() {
  log('\n📦 Step 2: Storage Bucket', 'cyan')
  log('=' .repeat(50), 'cyan')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl) {
    log('❌ NEXT_PUBLIC_SUPABASE_URL not found', 'red')
    return false
  }
  
  if (!serviceRoleKey) {
    log('⚠️  SUPABASE_SERVICE_ROLE_KEY not found', 'yellow')
    log('   Cannot create bucket automatically. Please create manually:', 'yellow')
    log('   1. Supabase Dashboard → Storage')
    log('   2. New bucket → Name: entry-photos')
    log('   3. Set to Public')
    log('   4. File size limit: 10MB')
    
    const answer = await question('\nHave you created the bucket? (y/n): ')
    if (answer.toLowerCase() !== 'y') {
      return false
    }
  } else {
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    log('\nChecking if entry-photos bucket exists...', 'blue')
    const { data: buckets } = await supabase.storage.listBuckets()
    const existingBucket = buckets?.find(b => b.name === 'entry-photos')
    
    if (existingBucket) {
      log('✅ entry-photos bucket already exists', 'green')
      return true
    }
    
    log('Creating entry-photos bucket...', 'blue')
    const { data, error } = await supabase.storage.createBucket('entry-photos', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
    
    if (error) {
      log(`❌ Failed to create bucket: ${error.message}`, 'red')
      log('   Please create manually in Supabase Dashboard', 'yellow')
      return false
    }
    
    log('✅ Successfully created entry-photos bucket', 'green')
  }
  
  return true
}

async function step3VerifySetup() {
  log('\n✅ Step 3: Verify Setup', 'cyan')
  log('=' .repeat(50), 'cyan')
  
  // Check environment variables
  log('\nChecking environment variables...', 'blue')
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'ANTHROPIC_API_KEY',
    'CRON_SECRET',
  ]
  
  const missingVars = requiredVars.filter(v => !process.env[v])
  
  if (missingVars.length > 0) {
    log('❌ Missing environment variables:', 'red')
    missingVars.forEach(v => log(`   - ${v}`, 'yellow'))
    log('\nPlease add them to .env.local', 'yellow')
    return false
  }
  
  log('✅ All required environment variables are set', 'green')
  
  // Check database
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  log('\nChecking database tables...', 'blue')
  const { error: themesError } = await supabase
    .from('weekly_themes')
    .select('id')
    .limit(1)
  
  if (themesError) {
    log('❌ weekly_themes table not found', 'red')
    return false
  }
  log('✅ weekly_themes table exists', 'green')
  
  // Check storage
  log('\nChecking storage bucket...', 'blue')
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminSupabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: buckets } = await adminSupabase.storage.listBuckets()
    const entryPhotosBucket = buckets?.find(b => b.name === 'entry-photos')
    
    if (!entryPhotosBucket) {
      log('❌ entry-photos bucket not found', 'red')
      return false
    }
    log('✅ entry-photos bucket exists', 'green')
  } else {
    log('⚠️  Cannot verify bucket (SUPABASE_SERVICE_ROLE_KEY not set)', 'yellow')
  }
  
  log('\n🎉 All setup steps completed successfully!', 'green')
  return true
}

async function main() {
  log('🚀 V3 Complete Setup Script', 'cyan')
  log('=' .repeat(50), 'cyan')
  
  // Check .env.local exists
  const envExists = await checkEnvFile()
  if (!envExists) {
    log('\n⚠️  Please fill in .env.local and run this script again', 'yellow')
    rl.close()
    process.exit(1)
  }
  
  // Step 1: Database Migrations
  const step1Complete = await step1DatabaseMigrations()
  if (!step1Complete) {
    log('\n⚠️  Step 1 incomplete. Please complete it and run again.', 'yellow')
    rl.close()
    process.exit(1)
  }
  
  // Step 2: Storage Bucket
  const step2Complete = await step2StorageBucket()
  if (!step2Complete) {
    log('\n⚠️  Step 2 incomplete. Please complete it and run again.', 'yellow')
    rl.close()
    process.exit(1)
  }
  
  // Step 3: Verify
  const step3Complete = await step3VerifySetup()
  
  rl.close()
  
  if (step3Complete) {
    log('\n✨ Setup Complete! V3 features are ready to use.', 'green')
    log('\nNext steps:', 'blue')
    log('1. Start dev server: npm run dev')
    log('2. Test weekly theme generation (create 7+ entries)')
    log('3. Test photo upload')
    log('4. Test PDF export')
    process.exit(0)
  } else {
    log('\n⚠️  Some verification checks failed. Please review and try again.', 'yellow')
    process.exit(1)
  }
}

main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red')
  rl.close()
  process.exit(1)
})

