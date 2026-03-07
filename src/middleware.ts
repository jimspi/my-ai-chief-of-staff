export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!login|register|api/auth|api/cron|api/google/callback|_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.svg|.*\\.webmanifest).*)',
  ],
}
