const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  },
  // Fix for multiple lockfiles issue - explicitly set the workspace root
  outputFileTracingRoot: path.join(__dirname, './'),
  // External packages that should NOT be bundled (native modules, PDF libraries)
  serverExternalPackages: [
    'pdf-parse', 
    'unpdf', 
    'pdfjs-dist',
    'pdf-to-png-converter',
    '@napi-rs/canvas',
    'canvas',
    'puppeteer-core',
    '@sparticuz/chromium-min',
  ],
  // Webpack configuration for native modules
  webpack: (config, { isServer }) => {
    // Exclude native modules from webpack processing
    config.externals.push({
      'canvas': 'commonjs canvas',
      '@napi-rs/canvas': 'commonjs @napi-rs/canvas',
    })
    
    // Ignore .node binary files
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    })
    
    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
