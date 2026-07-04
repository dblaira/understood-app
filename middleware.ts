import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Check for required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    console.error('Missing Supabase environment variables')
    // Allow request to continue but log error
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Let Supabase handle cookie options, but ensure secure in production
              response.cookies.set(name, value, {
                ...options,
                secure: process.env.NODE_ENV === 'production',
                sameSite: options?.sameSite || 'lax',
                path: options?.path || '/',
              })
            })
          },
        },
      }
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    const isPresentationLab =
      process.env.NODE_ENV !== 'production' &&
      request.nextUrl.pathname.startsWith('/lab/presentation')

    // Always allow access to login page, auth callback, debug pages, prototypes, and playground
    if (isPresentationLab ||
        request.nextUrl.pathname === '/login' || 
        request.nextUrl.pathname.startsWith('/auth/') ||
        request.nextUrl.pathname === '/debug-auth' || 
        request.nextUrl.pathname === '/debug-photo' ||
        request.nextUrl.pathname === '/leverage-proof' ||
        request.nextUrl.pathname.startsWith('/playground/')) {
      // Only redirect away from login if user is definitely authenticated
      if (request.nextUrl.pathname === '/login' && user && !error) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      // Otherwise, allow access to login/debug pages
      return response
    }

    // If there's an auth error, redirect to login
    if (error) {
      console.error('Auth error in middleware:', error.message)
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Protect main page - redirect to login if not authenticated
    if (request.nextUrl.pathname === '/' && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, allow access to login page, redirect others to login
    if (request.nextUrl.pathname === '/login') {
      return response
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (API routes)
     * - static files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|sw\\.js|manifest\\.json|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)',
  ],
}
