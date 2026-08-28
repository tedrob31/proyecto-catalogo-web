import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.pathname;

  // 1. Admin Authentication
  if (url.startsWith('/modaadmin')) {
    const authHeader = request.headers.get('authorization');
    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'password';

    if (!authHeader) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Admin Panel"',
        },
      });
    }

    const authValue = authHeader.split(' ')[1];
    const [user, pwd] = Buffer.from(authValue, 'base64').toString().split(':');

    if (user !== expectedUser || pwd !== expectedPassword) {
      return new NextResponse('Invalid credentials', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Admin Panel"',
        },
      });
    }
  }

  // 2. Maintenance Mode Check
  // We skip this check for static assets and the admin panel itself
  if (!url.startsWith('/modaadmin') && !url.startsWith('/_next') && !url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    // Note: Since middleware runs on edge by default, querying SQLite directly here using Prisma is NOT supported on Edge runtime.
    // So we fetch an API endpoint or use a local fetch workaround, but simple fetch to our own API might be slow.
    // For now, we will handle maintenance mode via a React Layout Server Component which DOES support SQLite,
    // OR we pass it. Next.js App Router layouts are server components, so they can check DB.
    // We'll let the layout handle maintenance mode redirection to keep middleware simple and edge-compatible.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
